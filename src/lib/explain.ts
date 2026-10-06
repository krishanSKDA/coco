/**
 * Phase 6 – feature-based explanation.
 *
 * Prototype stand-in for SHAP: each driver is replaced by its neutral
 * baseline and the change in the 7-day forecast is measured (occlusion),
 * then contributions are rescaled so they sum to the total deviation from
 * the all-baseline forecast (Shapley efficiency property). The production
 * system computes true SHAP values on the trained fusion model.
 */
import type { Attribution, TreatmentType } from '@/types'
import { type DriverOverrides, type ForecastInput, observedSlope, simulateMean } from './forecast'
import { leafWetnessHours } from './weather'
import { mean, round, sum } from './utils'

type Key = keyof DriverOverrides

const TREATMENT_LABEL: Record<TreatmentType, string> = {
  fungicide: 'Fungicide application',
  sanitation: 'Sanitation (frond removal)',
  fertilizer: 'Balanced fertilizer',
  drainage: 'Drainage improvement',
  shade_management: 'Shade management',
}

export function explainForecast(input: ForecastInput): Attribution[] {
  // Target: predicted change over 7 days, conditioned on the current
  // (image-estimated) severity. The image evidence itself is explained by
  // Grad-CAM, so current severity is the conditioning state, not a feature.
  const H = 7
  const delta = (o: DriverOverrides) => simulateMean(input, o).means[H] - input.currentSeverity

  const full = delta({})
  const allKeys: Key[] = ['rain', 'rh', 'temp', 'wetDays', 'leafWetness', 'wind', 'slope', 'treatment', 'context']
  const allBaseline = delta(Object.fromEntries(allKeys.map((k) => [k, true])))

  // Next 7 days of weather – the window that drives the 7-day forecast
  const win = [...input.observedWeather.slice(-3), ...input.forecastWeather.slice(0, 7)]
  const fw = input.forecastWeather.slice(0, 7)
  const rainNext = sum(fw.map((d) => d.rain))
  const rainPast = sum(input.observedWeather.slice(-7).map((d) => d.rain))
  const rh = mean(win.map((d) => d.rhMean))
  const t = mean(win.map((d) => d.tMean))
  const wet = fw.filter((d) => d.rain >= 1).length
  const lw = mean(win.map(leafWetnessHours))
  const wind = mean(win.map((d) => d.wind))
  const slope = observedSlope(input.currentSeverity, input.history)
  const recentTreatment = [...input.treatments].sort((a, b) => a.daysAgo - b.daysAgo)[0]
  const ctxParts = [
    input.context.drainage && `${input.context.drainage} drainage`,
    input.context.shade && `${input.context.shade} shade`,
    input.context.palmAgeBand && `${input.context.palmAgeBand} palms`,
  ].filter(Boolean)

  const items: Omit<Attribution, 'contribution' | 'statement'>[] = [
    { feature: 'rain', label: 'Rainfall', group: 'weather', displayValue: `${round(rainPast, 0)} mm past 7 d · ${round(rainNext, 0)} mm next 7 d` },
    { feature: 'rh', label: 'Relative humidity', group: 'weather', displayValue: `${round(rh, 0)} % mean` },
    { feature: 'temp', label: 'Temperature', group: 'weather', displayValue: `${round(t, 1)} °C mean` },
    { feature: 'wetDays', label: 'Wet days', group: 'weather', displayValue: `${wet} of next 7 days` },
    { feature: 'leafWetness', label: 'Leaf-wetness duration', group: 'weather', displayValue: `≈ ${round(lw, 1)} h/day` },
    { feature: 'wind', label: 'Wind (spore dispersal)', group: 'weather', displayValue: `${round(wind, 1)} m/s` },
    { feature: 'slope', label: 'Previous severity trend', group: 'history', displayValue: input.history.length ? `${slope >= 0 ? '+' : ''}${round(slope, 2)} units/day` : 'No prior observation' },
    { feature: 'treatment', label: 'Recent treatment', group: 'treatment', displayValue: recentTreatment ? `${TREATMENT_LABEL[recentTreatment.type]}, ${Math.round(recentTreatment.daysAgo)} d ago` : 'None recorded' },
    { feature: 'context', label: 'Crop context', group: 'context', displayValue: ctxParts.length ? ctxParts.join(', ') : 'Not provided' },
  ]

  const raw = items.map((it) => ({ ...it, contribution: full - delta({ [it.feature]: true } as DriverOverrides) }))

  // Efficiency rescaling
  const rawSum = sum(raw.map((r) => r.contribution))
  const target = full - allBaseline
  const scale = Math.abs(rawSum) > 1e-6 && Math.sign(rawSum) === Math.sign(target) ? target / rawSum : 1

  return raw
    .map((r) => {
      const c = round(r.contribution * scale, 3)
      return { ...r, contribution: c, statement: toStatement(r.label, r.displayValue, c) }
    })
    .filter((r) => Math.abs(r.contribution) >= 0.005)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
}

function toStatement(label: string, value: string, c: number) {
  const mag = Math.abs(c)
  const strength = mag > 0.4 ? 'strongly' : mag > 0.15 ? 'moderately' : 'slightly'
  const dir = c > 0 ? 'pushes the 7-day severity up' : 'holds the 7-day severity down'
  return `${label} (${value}) ${strength} ${dir} by ${mag.toFixed(2)} units.`
}
