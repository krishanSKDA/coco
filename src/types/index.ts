/**
 * Domain model for Component 04 – Explainable Multimodal Coconut Disease
 * Progression Forecasting. Field names follow Appendix A (data dictionary)
 * of the project proposal where applicable.
 */

export type DiseaseClass = 'healthy' | 'grey_leaf_spot' | 'brown_leaf_spot' | 'leaf_blight'

export type InterventionCategory = 'monitor' | 'prepare' | 'intervene'

export type AgroZone = 'wet' | 'intermediate' | 'dry'

export type Horizon = 3 | 7 | 14

export type Language = 'en' | 'si'

export type UserRole = 'grower' | 'officer'

export interface Plot {
  id: string
  name: string
  district: string
  zone: AgroZone
  latitude: number
  longitude: number
  owner: string
  palmCount: number
  /** Optional crop context – the model must run without it. */
  palmAgeBand?: 'young' | 'mature' | 'old'
  shade?: 'none' | 'partial' | 'heavy'
  drainage?: 'good' | 'moderate' | 'poor'
  createdAt: string
}

export interface DailyWeather {
  date: string // YYYY-MM-DD
  rain: number // mm
  rhMean: number // %
  rhMax: number // %
  tMean: number // °C
  tMin: number // °C
  tMax: number // °C
  wind: number // m/s
}

/** Table 4 – weather-window features derived for each observation. */
export interface WeatherWindowFeatures {
  rain3: number
  rain7: number
  rain14: number
  rhMean7: number
  rhMax7: number
  tMean7: number
  tMin7: number
  tMax7: number
  tRange7: number
  wetDays7: number
  wetDays14: number
  /** Estimated leaf-wetness hours per day (proxy from RH + rain occurrence). */
  leafWetness7: number
  wind7: number
}

export interface WeatherContext {
  source: 'nasa-power' | 'open-meteo' | 'simulated' | 'mixed'
  observed: DailyWeather[] // preceding 14 days
  forecast: DailyWeather[] // next 14 days
  window: WeatherWindowFeatures
  forecastWindow: WeatherWindowFeatures
}

export interface QualityReport {
  sharpness: number
  brightness: number
  frondRatio: number
  passed: boolean
  issues: string[]
}

export interface ImageAnalysis {
  diseaseClass: DiseaseClass
  classProbs: Record<DiseaseClass, number>
  severity: number // integer 0–4 (Table 3)
  severityProbs: number[] // length 5
  lesionFraction: number // 0–1 of frond area
  confidence: number // 0–1
}

export interface HorizonForecast {
  horizon: Horizon
  mean: number
  lower: number // 90 % interval
  upper: number
  sigma: number
  confidence: number // 0–1 calibrated confidence
}

export interface TrajectoryPoint {
  day: number
  mean: number
  lower: number
  upper: number
}

export interface Forecast {
  horizons: HorizonForecast[]
  trajectory: TrajectoryPoint[]
  progressionRisk: number // P(worsening by ≥ 0.5 units within 14 d)
  direction: 'improving' | 'stable' | 'worsening'
  weatherPressure: number // rate multiplier from weather, ~0.1–2
}

export interface Attribution {
  feature: string
  label: string
  group: 'image' | 'weather' | 'history' | 'treatment' | 'context'
  displayValue: string
  contribution: number // signed change in 7-day forecast (severity units)
  statement: string
}

export interface InterventionDecision {
  category: InterventionCategory
  reasons: string[]
  conservativeFallback: boolean
  lowConfidence: boolean
  crossingDay: number | null
  threshold: number
}

export interface Observation {
  id: string
  plotId: string
  timestamp: string
  latitude: number
  longitude: number
  stepIndex: number
  imageThumb?: string // data URL (downscaled)
  heatmapThumb?: string // data URL (Grad-CAM style overlay)
  quality: QualityReport
  analysis: ImageAnalysis
  weather: WeatherContext
  forecast: Forecast
  attributions: Attribution[]
  decision: InterventionDecision
  modelVersion: string
  syncStatus: 'synced' | 'queued'
  notes?: string
}

export type TreatmentType = 'fungicide' | 'sanitation' | 'fertilizer' | 'drainage' | 'shade_management'

export interface TreatmentEvent {
  id: string
  plotId: string
  date: string
  type: TreatmentType
  product?: string
  dose?: string
  notes?: string
}

export interface AlertItem {
  id: string
  plotId: string
  observationId: string
  createdAt: string
  from: InterventionCategory | null
  to: InterventionCategory
  message: string
  read: boolean
}

export interface Settings {
  language: Language
  role: UserRole
  actionThreshold: number
  confidenceThreshold: number
  liveWeather: boolean
}

export interface KnowledgeEntry {
  id: string
  title: string
  category: InterventionCategory | 'all'
  diseases: DiseaseClass[] | 'all'
  type: 'cultural' | 'monitoring' | 'nutrition' | 'chemical' | 'escalation'
  summary: string
  steps: string[]
  source: string
  reviewStatus: 'approved' | 'pending-review'
}
