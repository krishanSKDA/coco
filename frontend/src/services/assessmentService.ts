/**
 * Orchestrates one assessment end-to-end, mirroring the inference API that
 * the mobile app and officer dashboard share (FR-19):
 *
 *   POST /api/v1/plots/{plotId}/observations   (multipart: image, timestamp, lat, lon)
 *   → { observation, forecast, explanation, intervention }
 *
 * Lesion segmentation runs on the inference server (best.pt) when reachable and
 * on-device otherwise; forecast, explanation and intervention still run in the
 * app. The finished observation is uploaded to the server, or queued and
 * synchronised when back online (FR-16).
 */
import type { Observation, Plot, Settings, TreatmentEvent } from '@/types'
import type { ImagePipelineResult } from '@/lib/imageAnalysis'
import { buildObservation } from '@/lib/pipeline'
import { sleep } from '@/lib/utils'
import { uploadObservation } from './apiClient'
import { getWeatherContext } from './weatherService'

export const STAGES = [
  { key: 'quality', label: 'Image quality gate' },
  { key: 'encoder', label: 'Disease class & current severity' },
  { key: 'weather', label: 'Weather window retrieval' },
  { key: 'forecast', label: 'Multi-horizon forecast (3 / 7 / 14 d)' },
  { key: 'explain', label: 'Grad-CAM & SHAP explanations' },
  { key: 'decide', label: 'Intervention window' },
] as const

export type StageKey = (typeof STAGES)[number]['key']

export interface RunAssessmentArgs {
  plot: Plot
  image: ImagePipelineResult
  timestamp: string
  latitude: number
  longitude: number
  notes?: string
  previous: Observation[]
  treatments: TreatmentEvent[]
  settings: Settings
  online: boolean
}

export async function runAssessment(args: RunAssessmentArgs, onStage: (k: StageKey) => void): Promise<Observation> {
  onStage('quality')
  await sleep(250)
  onStage('encoder')
  await sleep(450)

  onStage('weather')
  const weather = await getWeatherContext({
    lat: args.latitude,
    lon: args.longitude,
    zone: args.plot.zone,
    date: new Date(args.timestamp),
    live: args.settings.liveWeather && args.online,
  })

  onStage('forecast')
  await sleep(350)
  onStage('explain')
  const obs = buildObservation({
    plot: args.plot,
    timestamp: args.timestamp,
    latitude: args.latitude,
    longitude: args.longitude,
    quality: args.image.quality,
    analysis: args.image.analysis,
    weather,
    previous: args.previous,
    treatments: args.treatments,
    settings: args.settings,
    imageThumb: args.image.imageThumb,
    heatmapThumb: args.image.heatmapThumb,
    notes: args.notes,
    syncStatus: 'queued',
  })
  await sleep(350)
  onStage('decide')
  // FR-19 – store on the server; stays queued (FR-16) when offline or unreachable
  const synced = args.online && (await uploadObservation(obs).then(() => true, () => false))
  return synced ? { ...obs, syncStatus: 'synced' } : obs
}
