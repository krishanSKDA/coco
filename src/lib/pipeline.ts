import type {
  AlertItem,
  ImageAnalysis,
  InterventionCategory,
  Observation,
  Plot,
  QualityReport,
  Settings,
  TreatmentEvent,
  WeatherContext,
} from '@/types'
import { CATEGORY_RANK, INTERVENTION, MODEL_VERSION } from './constants'
import { explainForecast } from './explain'
import { type ForecastInput, runForecast } from './forecast'
import { decideIntervention } from './intervention'
import { daysBetween, uid } from './utils'

export interface BuildObservationArgs {
  plot: Plot
  timestamp: string
  latitude?: number
  longitude?: number
  quality: QualityReport
  analysis: ImageAnalysis
  weather: WeatherContext
  previous: Observation[] // prior observations for this plot
  treatments: TreatmentEvent[]
  settings: Pick<Settings, 'actionThreshold' | 'confidenceThreshold'>
  imageThumb?: string
  heatmapThumb?: string
  notes?: string
  syncStatus?: Observation['syncStatus']
  id?: string
}

export function toForecastInput(args: Omit<BuildObservationArgs, 'settings' | 'quality'>): ForecastInput {
  const t = args.timestamp
  return {
    currentSeverity: args.analysis.severity,
    imageConfidence: args.analysis.confidence,
    history: args.previous
      .filter((o) => new Date(o.timestamp) < new Date(t))
      .map((o) => ({ daysAgo: daysBetween(o.timestamp, t), severity: o.analysis.severity })),
    observedWeather: args.weather.observed,
    forecastWeather: args.weather.forecast,
    treatments: args.treatments
      .filter((tr) => tr.plotId === args.plot.id && new Date(tr.date) <= new Date(t))
      .map((tr) => ({ daysAgo: daysBetween(tr.date, t), type: tr.type })),
    context: { palmAgeBand: args.plot.palmAgeBand, shade: args.plot.shade, drainage: args.plot.drainage },
    weatherIsSimulated: args.weather.source === 'simulated',
  }
}

/** Run forecast → explanation → decision and assemble an Observation record. */
export function buildObservation(args: BuildObservationArgs): Observation {
  const input = toForecastInput(args)
  const forecast = runForecast(input)
  const attributions = explainForecast(input)
  const decision = decideIntervention(args.analysis.severity, forecast, args.settings)

  return {
    id: args.id ?? uid('OBS'),
    plotId: args.plot.id,
    timestamp: args.timestamp,
    latitude: args.latitude ?? args.plot.latitude,
    longitude: args.longitude ?? args.plot.longitude,
    stepIndex: args.previous.length,
    imageThumb: args.imageThumb,
    heatmapThumb: args.heatmapThumb,
    quality: args.quality,
    analysis: args.analysis,
    weather: args.weather,
    forecast,
    attributions,
    decision,
    modelVersion: MODEL_VERSION,
    syncStatus: args.syncStatus ?? 'synced',
    notes: args.notes,
  }
}

/** FR-17 – raise an alert when a plot moves into a more urgent category. */
export function maybeAlert(plot: Plot, obs: Observation, prevCategory: InterventionCategory | null): AlertItem | null {
  const to = obs.decision.category
  const escalated = prevCategory === null ? to !== 'monitor' : CATEGORY_RANK[to] > CATEGORY_RANK[prevCategory]
  if (!escalated) return null
  const h7 = obs.forecast.horizons[1]
  return {
    id: uid('ALR'),
    plotId: plot.id,
    observationId: obs.id,
    createdAt: obs.timestamp,
    from: prevCategory,
    to,
    read: false,
    message: `${plot.name}: ${INTERVENTION[to].label.toLowerCase()} – 7-day forecast ${h7.mean.toFixed(1)} (severity now ${obs.analysis.severity}).`,
  }
}
