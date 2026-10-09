/**
 * YOLOv8-seg post-processing for the lesion model (FR-04/05/12), kept free of
 * browser APIs so it can be checked against the Python reference.
 *
 * Mirrors Ultralytics predict(): confidence 0.25, per-class NMS at IoU 0.7,
 * masks = coeffs · protos upsampled bilinearly to the input size, cropped to
 * the box and thresholded at logit 0. Severity uses the same leaf-area rule as
 * model/colab_lesion_segmentation.ipynb (OpenCV HSV green–yellow tissue).
 */

export const INPUT_SIZE = 640
export const CLASS_NAMES = ['healthy', 'lesion'] as const

const CONF = 0.25
const IOU = 0.7
const MAX_DET = 300
const NUM_MASKS = 32
const PROTO = 160
const LESION = CLASS_NAMES.indexOf('lesion')

export interface LesionSegmentation {
  /** INPUT_SIZE² lesion pixels (1 = lesion), in the stretched model frame */
  lesionMask: Uint8Array
  /** lesion area ÷ leaf area, 0–1 */
  lesionFraction: number
  lesionCount: number
  /** highest confidence among lesion / healthy detections (0 when none) */
  lesionConf: number
  healthyConf: number
}

interface Detection {
  index: number
  cls: number
  conf: number
  box: [number, number, number, number]
}

const iou = (a: Detection['box'], b: Detection['box']) => {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const inter = w * h
  return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)
}

/** OpenCV inRange(HSV, (20, 60, 40), (90, 255, 255)) on 8-bit RGB. */
function isLeafTissue(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (max < 40 || d === 0 || (255 * d) / max < 60) return false
  let h: number
  if (max === r) h = (60 * (g - b)) / d
  else if (max === g) h = (60 * (b - r)) / d + 120
  else h = (60 * (r - g)) / d + 240
  if (h < 0) h += 360
  const H = Math.round(h / 2)
  return H >= 20 && H <= 90
}

/**
 * @param out0   output0, shape [1, 4 + classes + 32, anchors]
 * @param protos output1, shape [1, 32, 160, 160]
 * @param rgba   INPUT_SIZE² RGBA pixels of the stretched input image
 */
export function postprocess(out0: Float32Array, protos: Float32Array, rgba: Uint8ClampedArray | Uint8Array): LesionSegmentation {
  const nc = CLASS_NAMES.length
  const anchors = out0.length / (4 + nc + NUM_MASKS)
  const at = (row: number, i: number) => out0[row * anchors + i]

  const candidates: Detection[] = []
  for (let i = 0; i < anchors; i++) {
    let cls = 0
    for (let c = 1; c < nc; c++) if (at(4 + c, i) > at(4 + cls, i)) cls = c
    const conf = at(4 + cls, i)
    if (conf <= CONF) continue
    const cx = at(0, i)
    const cy = at(1, i)
    const w = at(2, i)
    const h = at(3, i)
    candidates.push({ index: i, cls, conf, box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] })
  }
  candidates.sort((a, b) => b.conf - a.conf)

  const kept: Detection[] = []
  for (const d of candidates) {
    if (kept.length >= MAX_DET) break
    if (kept.every((k) => k.cls !== d.cls || iou(k.box, d.box) <= IOU)) kept.push(d)
  }

  const S = INPUT_SIZE
  const scale = PROTO / S
  const lesionMask = new Uint8Array(S * S)
  const logits = new Float32Array(PROTO * PROTO)
  let lesionCount = 0
  let lesionConf = 0
  let healthyConf = 0

  for (const d of kept) {
    if (d.cls !== LESION) {
      healthyConf = Math.max(healthyConf, d.conf)
      continue
    }
    lesionCount++
    lesionConf = Math.max(lesionConf, d.conf)

    logits.fill(0)
    for (let k = 0; k < NUM_MASKS; k++) {
      const coeff = at(4 + nc + k, d.index)
      const base = k * PROTO * PROTO
      for (let j = 0; j < PROTO * PROTO; j++) logits[j] += coeff * protos[base + j]
    }

    // Bilinear upsample (align_corners = false) inside the box only
    const [x1, y1, x2, y2] = d.box
    for (let y = Math.max(0, Math.ceil(y1)); y < Math.min(S, y2); y++) {
      const sy = Math.min(Math.max((y + 0.5) * scale - 0.5, 0), PROTO - 1)
      const y0 = Math.floor(sy)
      const yb = Math.min(y0 + 1, PROTO - 1)
      const fy = sy - y0
      for (let x = Math.max(0, Math.ceil(x1)); x < Math.min(S, x2); x++) {
        const sx = Math.min(Math.max((x + 0.5) * scale - 0.5, 0), PROTO - 1)
        const x0 = Math.floor(sx)
        const xb = Math.min(x0 + 1, PROTO - 1)
        const fx = sx - x0
        const top = logits[y0 * PROTO + x0] * (1 - fx) + logits[y0 * PROTO + xb] * fx
        const bottom = logits[yb * PROTO + x0] * (1 - fx) + logits[yb * PROTO + xb] * fx
        if (top * (1 - fy) + bottom * fy > 0) lesionMask[y * S + x] = 1
      }
    }
  }

  let lesionPx = 0
  let leafPx = 0
  for (let i = 0; i < S * S; i++) {
    const lesion = lesionMask[i] === 1
    if (lesion) lesionPx++
    if (lesion || isLeafTissue(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])) leafPx++
  }

  return {
    lesionMask,
    lesionFraction: leafPx > 0 ? lesionPx / leafPx : 0,
    lesionCount,
    lesionConf,
    healthyConf,
  }
}
