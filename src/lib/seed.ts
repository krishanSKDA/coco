/**
 * Deterministic demo data: plots across the Coconut Triangle, the wet zone and
 * the dry zone, each with a short observation history built by the same
 * engine the app uses for live assessments.
 */
import type { AlertItem, DiseaseClass, ImageAnalysis, Observation, Plot, QualityReport, Settings, TreatmentEvent } from '@/types'
import { buildObservation, maybeAlert, toForecastInput } from './pipeline'
import { simulateMean } from './forecast'
import { addDays, clamp, gaussian, isoDate, mulberry32, round } from './utils'
import { forecastWindowFeatures, syntheticSeries, windowFeatures } from './weather'

interface PlotSpec {
  plot: Omit<Plot, 'createdAt'>
  disease: DiseaseClass
  startSeverity: number
  visits: number
  treatments?: { daysBeforeToday: number; type: TreatmentEvent['type']; product?: string; dose?: string; notes?: string }[]
}

const SPECS: PlotSpec[] = [
  {
    plot: { id: 'PLT-GAM-0002', name: 'Minuwangoda Smallholding', district: 'Gampaha', zone: 'wet', latitude: 7.1667, longitude: 79.95, owner: 'W. A. Perera', palmCount: 120, palmAgeBand: 'old', shade: 'heavy', drainage: 'poor' },
    disease: 'leaf_blight',
    startSeverity: 1,
    visits: 3,
  },
  {
    plot: { id: 'PLT-KUR-0001', name: 'Wariyapola Estate â€“ Block A', district: 'Kurunegala', zone: 'intermediate', latitude: 7.6236, longitude: 80.2358, owner: 'Wariyapola Estates (Pvt) Ltd', palmCount: 850, palmAgeBand: 'mature', shade: 'partial', drainage: 'moderate' },
    disease: 'grey_leaf_spot',
    startSeverity: 1,
    visits: 5,
  },
  {
    plot: { id: 'PLT-PUT-0005', name: 'Lunuwila Research Block', district: 'Puttalam', zone: 'intermediate', latitude: 7.3497, longitude: 79.8564, owner: 'Research partner', palmCount: 300, palmAgeBand: 'mature', shade: 'none', drainage: 'good' },
    disease: 'grey_leaf_spot',
    startSeverity: 2,
    visits: 6,
    treatments: [{ daysBeforeToday: 9, type: 'sanitation', notes: 'Removed and burned 40 severely affected outer fronds' }],
  },
  {
    plot: { id: 'PLT-MAT-0004', name: 'Akuressa Home Garden', district: 'Matara', zone: 'wet', latitude: 6.1, longitude: 80.4833, owner: 'K. D. Silva', palmCount: 35, palmAgeBand: 'mature', shade: 'partial', drainage: 'moderate' },
    disease: 'brown_leaf_spot',
    startSeverity: 2,
    visits: 4,
    treatments: [
      { daysBeforeToday: 12, type: 'fungicide', product: 'As recommended by extension officer', dose: 'Per label', notes: 'Confirmed by CDO before application' },
      { daysBeforeToday: 30, type: 'fertilizer', product: 'Adult palm mixture (CRI)', dose: 'Per CRI schedule' },
    ],
  },
  {
    plot: { id: 'PLT-PUT-0003', name: 'Chilaw Coastal Plot', district: 'Puttalam', zone: 'dry', latitude: 7.5758, longitude: 79.7953, owner: 'R. M. Bandara', palmCount: 210, palmAgeBand: 'young', shade: 'none', drainage: 'good' },
    disease: 'grey_leaf_spot',
    startSeverity: 0,
    visits: 4,
  },
  {
    plot: { id: 'PLT-HAM-0006', name: 'Tissamaharama Dry-Zone Plot', district: 'Hambantota', zone: 'dry', latitude: 6.2783, longitude: 81.2878, owner: 'S. Jayawardena', palmCount: 90, palmAgeBand: 'young', shade: 'none', drainage: 'good' },
    disease: 'leaf_blight',
    startSeverity: 1,
    visits: 3,
  },
]

function syntheticAnalysis(severity: number, disease: DiseaseClass, rand: () => number): ImageAnalysis {
  const s = clamp(Math.round(severity), 0, 4)
  const severityProbs = [0, 1, 2, 3, 4].map((k) => Math.exp(-((k - s) ** 2) / 0.4) * (0.8 + rand() * 0.4))
  const tot = severityProbs.reduce((a, b) => a + b, 0)
  const cls: DiseaseClass = s === 0 ? 'healthy' : disease
  const top = 0.78 + rand() * 0.15
  const others = (['healthy', 'grey_leaf_spot', 'brown_leaf_spot', 'leaf_blight'] as DiseaseClass[]).filter((c) => c !== cls)
  const classProbs = { [cls]: round(top, 3) } as Record<DiseaseClass, number>
  others.forEach((c, i) => (classProbs[c] = round(((1 - top) * [0.5, 0.3, 0.2][i]), 3)))
  return {
    diseaseClass: cls,
    classProbs,
    severity: s,
    severityProbs: severityProbs.map((p) => round(p / tot, 3)),
    lesionFraction: round([0, 0.03, 0.12, 0.33, 0.62][s] * (0.85 + rand() * 0.3), 3),
    confidence: round(0.8 + rand() * 0.14, 2),
  }
}

const goodQuality = (rand: () => number): QualityReport => ({
  sharpness: Math.round(140 + rand() * 260),
  brightness: Math.round(105 + rand() * 50),
  frondRatio: round(0.55 + rand() * 0.3, 2),
  passed: true,
  issues: [],
})

export function buildSeed(settings: Pick<Settings, 'actionThreshold' | 'confidenceThreshold'>) {
  const today = new Date()
  today.setHours(9, 30, 0, 0)
  const plots: Plot[] = []
  const observations: Observation[] = []
  const treatments: TreatmentEvent[] = []
  const alerts: AlertItem[] = []

  SPECS.forEach((spec, pi) => {
    const rand = mulberry32(1000 + pi * 97)
    const plot: Plot = { ...spec.plot, createdAt: addDays(today, -spec.visits * 7 - 10).toISOString() }
    plots.push(plot)

    for (const t of spec.treatments ?? []) {
      treatments.push({
        id: `TRT-${plot.id.slice(4)}-${t.daysBeforeToday}`,
        plotId: plot.id,
        date: isoDate(addDays(today, -t.daysBeforeToday)),
        type: t.type,
        product: t.product,
        dose: t.dose,
        notes: t.notes,
      })
    }

    const plotObs: Observation[] = []
    let severity = spec.startSeverity
    let prevCategory: Observation['decision']['category'] | null = null
    for (let v = 0; v < spec.visits; v++) {
      const daysBefore = (spec.visits - 1 - v) * 7 + (v === spec.visits - 1 ? 1 : 0)
      const date = addDays(today, -daysBefore)
      date.setHours(8 + Math.floor(rand() * 6), Math.floor(rand() * 60))
      const observed = syntheticSeries(plot.latitude, plot.longitude, plot.zone, addDays(date, -13), 14)
      const forecast = syntheticSeries(plot.latitude, plot.longitude, plot.zone, addDays(date, 1), 14)
      const weather = { source: 'simulated' as const, observed, forecast, window: windowFeatures(observed), forecastWindow: forecastWindowFeatures(forecast) }

      const obs = buildObservation({
        id: `OBS-${plot.id.slice(4)}-${String(v + 1).padStart(2, '0')}`,
        plot,
        timestamp: date.toISOString(),
        quality: goodQuality(rand),
        analysis: syntheticAnalysis(severity, spec.disease, rand),
        weather,
        previous: plotObs,
        treatments,
        settings,
      })
      plotObs.push(obs)
      const alert = maybeAlert(plot, obs, prevCategory)
      // Escalations from the last ~10 days are still unread in the demo
      if (alert) alerts.push({ ...alert, read: daysBefore > 10 })
      prevCategory = obs.decision.category

      // Evolve "true" severity to the next visit with the same engine + noise
      const { means } = simulateMean(toForecastInput({ plot, timestamp: obs.timestamp, analysis: obs.analysis, weather, previous: plotObs.slice(0, -1), treatments }))
      severity = clamp(Math.round(means[7] + gaussian(rand) * 0.25), 0, 4)
    }
    observations.push(...plotObs)
  })

  return { plots, observations, treatments, alerts }
}
