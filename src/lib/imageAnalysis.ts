/**
 * Client-side image pipeline for the prototype.
 *
 *  - Image quality gate (FR-03): sharpness (Laplacian variance), exposure and
 *    a frond-presence check – these are real measurements.
 *  - Disease class + severity (FR-04/05): a colour-segmentation heuristic that
 *    stands in for the transfer-learned EfficientNet / MobileNetV2 encoder.
 *  - Grad-CAM style overlay (FR-12): a smoothed lesion-evidence map rendered
 *    with a jet colour-map. In production this is true Grad-CAM on the final
 *    convolutional block of the trained encoder.
 */
import type { DiseaseClass, ImageAnalysis, QualityReport } from '@/types'
import { clamp, mulberry32, round } from './utils'

const WORK = 256 // working resolution
const THUMB = 360

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })

function drawScaled(img: HTMLImageElement, maxDim: number) {
  const s = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * s))
  const h = Math.max(1, Math.round(img.height * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  return { canvas: c, ctx, w, h }
}

function rgbToHsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 }
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1)
      acc += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1)
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]
    }
  }
  return out
}

function jet(v: number): [number, number, number] {
  const r = clamp(1.5 - Math.abs(4 * v - 3), 0, 1)
  const g = clamp(1.5 - Math.abs(4 * v - 2), 0, 1)
  const b = clamp(1.5 - Math.abs(4 * v - 1), 0, 1)
  return [r * 255, g * 255, b * 255]
}

function softmax(xs: number[], temp = 1) {
  const m = Math.max(...xs)
  const e = xs.map((x) => Math.exp((x - m) / temp))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / s)
}

/** Map frond lesion fraction to the continuous 0–4 scale (Table 3 area bands). */
function lesionToSeverity(f: number) {
  const knots: [number, number][] = [
    [0, 0],
    [0.01, 0.5],
    [0.05, 1.5],
    [0.2, 2.5],
    [0.5, 3.5],
    [1, 4],
  ]
  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1]
    const [x1, y1] = knots[i]
    if (f <= x1) return y0 + ((f - x0) / (x1 - x0)) * (y1 - y0)
  }
  return 4
}

export interface ImagePipelineResult {
  quality: QualityReport
  analysis: ImageAnalysis
  imageThumb: string
  heatmapThumb: string
}

export async function analyzeImage(src: string): Promise<ImagePipelineResult> {
  const img = await loadImage(src)
  const { ctx, w, h } = drawScaled(img, WORK)
  const { data } = ctx.getImageData(0, 0, w, h)
  const n = w * h

  // --- Quality: luminance, Laplacian variance
  const lum = new Float32Array(n)
  let lumSum = 0
  for (let i = 0; i < n; i++) {
    const l = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    lum[i] = l
    lumSum += l
  }
  const brightness = lumSum / n
  let lapSum = 0
  let lapSq = 0
  let cnt = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const v = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]
      lapSum += v
      lapSq += v * v
      cnt++
    }
  }
  const lapMean = lapSum / cnt
  const sharpness = lapSq / cnt - lapMean * lapMean

  // --- Segmentation
  const healthy = new Float32Array(n)
  const brown = new Float32Array(n)
  const yellow = new Float32Array(n)
  const grey = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const { h: hue, s, v } = rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
    if (v < 0.12 || v > 0.97) continue
    if (hue >= 65 && hue <= 170 && s > 0.18) healthy[i] = 1
    else if (hue >= 45 && hue < 65 && s > 0.28) yellow[i] = 1
    else if (hue >= 8 && hue < 45 && s > 0.2 && v < 0.88) brown[i] = 1
    else if (s < 0.16 && v > 0.3 && v < 0.82) grey[i] = 1
  }
  // Grey only counts as lesion when it sits inside foliage (not sky / soil)
  const foliage = boxBlur(healthy, w, h, 6)
  let nH = 0
  let nB = 0
  let nY = 0
  let nG = 0
  const lesion = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (grey[i] && foliage[i] < 0.22) grey[i] = 0
    if ((brown[i] || yellow[i]) && foliage[i] < 0.05) {
      brown[i] = 0
      yellow[i] = 0
    }
    nH += healthy[i]
    nB += brown[i]
    nY += yellow[i]
    nG += grey[i]
    lesion[i] = brown[i] || grey[i] ? 1 : yellow[i] ? 0.6 : 0
  }
  const nL = nB + nY + nG
  const frond = nH + nL
  const frondRatio = frond / n
  const lesionFraction = frond > 0 ? nL / frond : 0

  const issues: string[] = []
  if (frondRatio < 0.2) issues.push('No coconut frond detected – frame the leaflets so they fill most of the picture.')
  if (sharpness < 30) issues.push('Image appears blurred – hold the camera steady and refocus.')
  if (brightness < 50) issues.push('Image is under-exposed – retake in better light.')
  if (brightness > 215) issues.push('Image is over-exposed – avoid direct sun glare.')
  const passed = frondRatio >= 0.2 && sharpness >= 15 && brightness >= 35 && brightness <= 230

  const quality: QualityReport = {
    sharpness: round(sharpness, 0),
    brightness: round(brightness, 0),
    frondRatio: round(frondRatio, 2),
    passed,
    issues,
  }

  // --- Severity (ordinal) + class
  const cont = lesionToSeverity(lesionFraction)
  const severityProbs = softmax([0, 1, 2, 3, 4].map((k) => -((k - cont) ** 2) / 0.35)).map((p) => round(p, 3))
  const severity = severityProbs.indexOf(Math.max(...severityProbs))

  const lesionTot = Math.max(nL, 1)
  const gShare = nG / lesionTot
  const bShare = nB / lesionTot
  const yShare = nY / lesionTot
  const classes: DiseaseClass[] = ['healthy', 'grey_leaf_spot', 'brown_leaf_spot', 'leaf_blight']
  const scores = [
    Math.max(0, 1.2 - cont) * 2.2,
    0.3 + 2.0 * gShare + (lesionFraction < 0.3 ? 0.3 : 0),
    0.3 + 1.6 * bShare * (lesionFraction < 0.2 ? 1.2 : 0.7),
    0.2 + 1.4 * (yShare + bShare) * (lesionFraction > 0.15 ? 1.6 : 0.5),
  ]
  const probs = softmax(scores, 0.45)
  const classProbs = Object.fromEntries(classes.map((c, i) => [c, round(probs[i], 3)])) as Record<DiseaseClass, number>
  const diseaseClass = severity === 0 ? 'healthy' : classes.slice(1)[probs.slice(1).indexOf(Math.max(...probs.slice(1)))]

  const qualityPenalty = (sharpness < 30 ? 0.12 : 0) + (brightness < 50 || brightness > 215 ? 0.1 : 0)
  const confidence = round(clamp(Math.max(...severityProbs) * 0.5 + Math.max(...probs) * 0.5 - qualityPenalty, 0.3, 0.97), 2)

  // --- Thumbnails
  const thumb = drawScaled(img, THUMB)
  const imageThumb = thumb.canvas.toDataURL('image/jpeg', 0.82)

  // --- Grad-CAM style overlay at working res, upscaled onto the thumbnail
  const blurred = boxBlur(boxBlur(lesion, w, h, 5), w, h, 4)
  let max = 0
  for (let i = 0; i < n; i++) max = Math.max(max, blurred[i])
  const camCanvas = document.createElement('canvas')
  camCanvas.width = w
  camCanvas.height = h
  const camCtx = camCanvas.getContext('2d')!
  const cam = camCtx.createImageData(w, h)
  for (let i = 0; i < n; i++) {
    const v = max > 0 ? blurred[i] / max : 0
    const [r, g, b] = jet(v)
    cam.data[i * 4] = r
    cam.data[i * 4 + 1] = g
    cam.data[i * 4 + 2] = b
    cam.data[i * 4 + 3] = v < 0.08 ? 40 : Math.round(90 + v * 140)
  }
  camCtx.putImageData(cam, 0, 0)
  thumb.ctx.imageSmoothingQuality = 'high'
  thumb.ctx.drawImage(camCanvas, 0, 0, thumb.w, thumb.h)
  const heatmapThumb = thumb.canvas.toDataURL('image/jpeg', 0.82)

  return {
    quality,
    analysis: { diseaseClass, classProbs, severity, severityProbs, lesionFraction: round(lesionFraction, 3), confidence },
    imageThumb,
    heatmapThumb,
  }
}

/**
 * Procedurally paint a coconut frond with grey-leaf-spot lesions so the full
 * pipeline can be demonstrated without field photographs.
 */
export function generateDemoLeaf(severity: number, seed = Date.now()): string {
  const rand = mulberry32(seed)
  const W = 640
  const H = 480
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  // Background: blurred canopy / sky
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#9fb8a0')
  bg.addColorStop(1, '#5b6b4f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Rachis
  const x0 = -20
  const y0 = H * 0.78
  const x1 = W + 20
  const y1 = H * 0.22
  ctx.strokeStyle = '#8a7a3a'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(W * 0.5, H * 0.38, x1, y1)
  ctx.stroke()

  // Leaflets
  const leaflets = new Path2D()
  const N = 22
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const bx = x0 + (x1 - x0) * t
    const by = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 50
    for (const side of [-1, 1]) {
      const ang = -0.55 + side * 1.05 + (rand() - 0.5) * 0.15
      const len = 190 + rand() * 60
      const wid = 16 + rand() * 6
      const p = new Path2D()
      const ex = bx + Math.cos(ang) * len
      const ey = by + Math.sin(ang) * len
      const nx = -Math.sin(ang) * wid
      const ny = Math.cos(ang) * wid
      p.moveTo(bx, by)
      p.quadraticCurveTo((bx + ex) / 2 + nx, (by + ey) / 2 + ny, ex, ey)
      p.quadraticCurveTo((bx + ex) / 2 - nx, (by + ey) / 2 - ny, bx, by)
      leaflets.addPath(p)
      const g = ctx.createLinearGradient(bx, by, ex, ey)
      const tone = 0.85 + rand() * 0.25
      g.addColorStop(0, `rgb(${46 * tone},${120 * tone},${40 * tone})`)
      g.addColorStop(1, `rgb(${80 * tone},${150 * tone},${50 * tone})`)
      ctx.fillStyle = g
      ctx.fill(p)
      ctx.strokeStyle = 'rgba(30,70,25,0.6)'
      ctx.lineWidth = 1
      ctx.stroke(p)
    }
  }

  // Lesions clipped to leaflets
  ctx.save()
  ctx.clip(leaflets)
  const s = clamp(severity, 0, 4)
  if (s >= 3.5) {
    // drying leaflets
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = `rgba(${150 + rand() * 40},${115 + rand() * 30},${50 + rand() * 20},0.85)`
      ctx.beginPath()
      ctx.ellipse(rand() * W, rand() * H, 70 + rand() * 80, 40 + rand() * 50, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const spots = [0, 10, 45, 110, 190][Math.round(s)]
  const sizeBase = [0, 4, 7, 12, 16][Math.round(s)]
  for (let k = 0; k < spots; k++) {
    const x = rand() * W
    const y = rand() * H
    const r = sizeBase * (0.6 + rand() * 0.9)
    ctx.fillStyle = 'rgba(214,190,70,0.55)' // chlorotic halo
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.7, r * 1.25, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6b4a24' // brown margin
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.15, r * 0.85, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#9b9a93' // grey centre
    ctx.beginPath()
    ctx.ellipse(x, y, r * 0.7, r * 0.5, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  return c.toDataURL('image/jpeg', 0.9)
}
