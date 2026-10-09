/**
 * Lesion segmentation with the YOLOv8n-seg model trained in
 * model/colab_lesion_segmentation.ipynb.
 *
 *  - Online: best.pt on the inference server (backend/, POST /api/v1/analyze).
 *  - Offline or server unreachable: the same weights exported to ONNX, run
 *    on-device in WebAssembly (Table 5: on-device inference, model ≤ 60 MB;
 *    FR-16 offline use once the model file is cached).
 */
import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { analyzeOnServer, serverAvailable } from '@/services/apiClient'
import { INPUT_SIZE, postprocess, type LesionSegmentation } from './lesionPostprocess'

export const LESION_MODEL = {
  url: `${import.meta.env.BASE_URL}models/lesion-seg-v3.onnx`,
  version: 'yolov8n-seg-lesion-v3',
  dataset: 'Roboflow coconut-diseases v3',
}

ort.env.wasm.wasmPaths = { wasm: wasmUrl }

let session: Promise<ort.InferenceSession> | null = null

function getSession() {
  session ??= ort.InferenceSession.create(LESION_MODEL.url, { executionProviders: ['wasm'] }).catch((e: unknown) => {
    session = null // allow a retry, e.g. after coming back online
    throw e
  })
  return session
}

/** Start downloading and compiling the model before the first assessment. */
export const warmUpLesionModel = () => getSession().then(() => undefined)

export async function segmentLesions(img: CanvasImageSource): Promise<LesionSegmentation> {
  const S = INPUT_SIZE
  // Stretch to 640×640, matching the Roboflow "Resize: Stretch" preprocessing
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, S, S)
  const { data } = ctx.getImageData(0, 0, S, S)

  const input = new Float32Array(3 * S * S)
  for (let i = 0; i < S * S; i++) {
    input[i] = data[i * 4] / 255
    input[S * S + i] = data[i * 4 + 1] / 255
    input[2 * S * S + i] = data[i * 4 + 2] / 255
  }

  const sess = await getSession()
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, S, S]) })
  const [out0, protos] = sess.outputNames.map((n) => out[n].data as Float32Array)
  return postprocess(out0, protos, data)
}

export type LesionEngine = 'server' | 'device'

export interface LesionResult extends LesionSegmentation {
  model: string
  engine: LesionEngine
}

async function decodeMask(png: string) {
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const mask = new Uint8Array(INPUT_SIZE * INPUT_SIZE)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4] > 127 ? 1 : 0
  return mask
}

/** Server inference with best.pt when reachable, otherwise the on-device ONNX model. */
export async function segmentLesionsBestAvailable(img: CanvasImageSource, src: string): Promise<LesionResult> {
  if (await serverAvailable()) {
    try {
      const r = await analyzeOnServer(src)
      return {
        lesionMask: await decodeMask(r.lesion_mask_png),
        lesionFraction: r.lesion_fraction,
        lesionCount: r.lesion_count,
        lesionConf: r.lesion_conf,
        healthyConf: r.healthy_conf,
        model: r.model,
        engine: 'server',
      }
    } catch (e) {
      console.warn('[lesion-model] server inference failed, using on-device model', e)
    }
  }
  return { ...(await segmentLesions(img)), model: LESION_MODEL.version, engine: 'device' }
}
