/**
 * Prototype progression engine.
 *
 * In the research system this is the trained multimodal network (image
 * encoder + temporal encoder + fusion + multi-horizon heads). For the
 * front-end prototype we use the same weather-modulated logistic
 * disease-progress model that the proposal uses to *generate* corpus
 * trajectories (Phase 2), so the UI receives realistic, internally
 * consistent forecasts with calibrated-looking uncertainty.
 */
import type { DailyWeather, Forecast, Horizon, HorizonForecast, Plot, TrajectoryPoint, TreatmentType } from '@/types'
import { clamp, mean, normCdf, round } from './utils'
import { leafWetnessHours } from './weather'

export const MAX_SEVERITY = 4
// Base logistic rate per day. Calibrated so that severity 2 under wet,
// humid, cool conditions reaches ≈ 3 within 7 days (Appendix C scenario).
const R0 = 0.075
const DT = 0.25
const Z90 = 1.645

export interface ForecastInput {
  currentSeverity: number
  imageConfidence: number
  /** Previous observations for this plot (most recent first is not required). */
  history: { daysAgo: number; severity: number }[]
  observedWeather: DailyWeather[] // 14 days up to the observation date
  forecastWeather: DailyWeather[] // 14 days after the observation date
  treatments: { daysAgo: number; type: TreatmentType }[]
  context: Pick<Plot, 'palmAgeBand' | 'shade' | 'drainage'>
  weatherIsSimulated?: boolean
}

/** Drivers that can be replaced by a neutral baseline for attribution. */
export interface DriverOverrides {
  rain?: boolean
  rh?: boolean
  temp?: boolean
  wetDays?: boolean
  leafWetness?: boolean
  wind?: boolean
  slope?: boolean
  treatment?: boolean
  context?: boolean
  s0?: boolean
}

/** Neutral (climatological) values used as the attribution baseline. */
export const BASELINE = {
  rain7: 25,
  rhMean7: 78,
  tMean7: 28,
  wetDays7: 3,
  leafWetness7: 6,
  wind7: 2.5,
  slope: 0,
  s0: 1,
}

interface DayDrivers {
  rain7: number
  rhMean7: number
  tMean7: number
  wetDays7: number
  leafWetness7: number
  wind7: number
}

function driversAt(series: DailyWeather[], endIdx: number): DayDrivers {
  const w = series.slice(Math.max(0, endIdx - 6), endIdx + 1)
  return {
    rain7: w.reduce((a, d) => a + d.rain, 0),
    rhMean7: mean(w.map((d) => d.rhMean)),
    tMean7: mean(w.map((d) => d.tMean)),
    wetDays7: w.filter((d) => d.rain >= 1).length,
    leafWetness7: mean(w.map(leafWetnessHours)),
    wind7: mean(w.map((d) => d.wind)),
  }
}

/**
 * Weather rate multiplier grounded in [5]: intensity correlates positively
 * with RH and rainfall and negatively with temperature; wetness duration and
 * wind (dispersal) add smaller effects.
 */
export function weatherMultiplier(d: DayDrivers, o: DriverOverrides = {}) {
  const rain7 = o.rain ? BASELINE.rain7 : d.rain7
  const rh = o.rh ? BASELINE.rhMean7 : d.rhMean7
  const t = o.temp ? BASELINE.tMean7 : d.tMean7
  const wet = o.wetDays ? BASELINE.wetDays7 : d.wetDays7
  const lw = o.leafWetness ? BASELINE.leafWetness7 : d.leafWetness7
  const wind = o.wind ? BASELINE.wind7 : d.wind7

  // Intercept chosen so the neutral BASELINE climate gives m ≈ 1.0
  const m =
    0.74 +
    0.22 * clamp((rh - 75) / 12, -1, 1.5) +
    0.16 * clamp(rain7 / 50, 0, 2) +
    0.18 * clamp((28 - t) / 3, -1, 1.5) +
    0.12 * (wet / 7) +
    0.14 * clamp(lw / 12, 0, 1.5) +
    0.05 * clamp((wind - 2.5) / 3, -0.5, 1)
  return clamp(m, 0.05, 2)
}

function contextMultiplier(c: ForecastInput['context']) {
  let m = 1
  if (c.drainage === 'poor') m *= 1.15
  else if (c.drainage === 'moderate') m *= 1.05
  if (c.shade === 'heavy') m *= 1.12
  else if (c.shade === 'partial') m *= 1.04
  if (c.palmAgeBand === 'old') m *= 1.06
  return m
}

function treatmentEffect(treatments: ForecastInput['treatments'], dayOffset: number) {
  let rate = 1
  let recovery = 0
  for (const tr of treatments) {
    const since = tr.daysAgo + dayOffset
    if (since < 0) continue
    switch (tr.type) {
      case 'fungicide':
        if (since <= 21) {
          rate *= 0.35
          recovery += 0.018
        }
        break
      case 'sanitation':
        if (since <= 30) {
          rate *= 0.75
          recovery += 0.008
        }
        break
      case 'fertilizer':
        if (since <= 60) rate *= 0.9
        break
      case 'drainage':
        if (since <= 90) rate *= 0.9
        break
      case 'shade_management':
        if (since <= 90) rate *= 0.92
        break
    }
  }
  return { rate, recovery }
}

/** Observed slope (severity units/day) from the most recent prior observation. */
export function observedSlope(current: number, history: ForecastInput['history']) {
  const prev = [...history].filter((h) => h.daysAgo > 0.5).sort((a, b) => a.daysAgo - b.daysAgo)[0]
  if (!prev) return 0
  return clamp((current - prev.severity) / prev.daysAgo, -0.3, 0.3)
}

/** Integrate the mean trajectory for days 0..14. */
export function simulateMean(input: ForecastInput, o: DriverOverrides = {}) {
  const series = [...input.observedWeather, ...input.forecastWeather]
  const base = input.observedWeather.length - 1 // index of observation day
  const s0 = o.s0 ? BASELINE.s0 : input.currentSeverity
  const slope = o.slope ? BASELINE.slope : observedSlope(input.currentSeverity, input.history)
  const ctx = o.context ? 1 : contextMultiplier(input.context)

  const means: number[] = [s0]
  const multipliers: number[] = []
  let s = s0
  for (let day = 1; day <= 14; day++) {
    const drivers = driversAt(series, base + day)
    const m = weatherMultiplier(drivers, o)
    multipliers.push(m)
    const trt = o.treatment ? { rate: 1, recovery: 0 } : treatmentEffect(input.treatments, day)
    for (let k = 0; k < 1 / DT; k++) {
      const t = day - 1 + k * DT
      const growth = R0 * m * ctx * trt.rate * (s + 0.05) * (1 - s / MAX_SEVERITY)
      const momentum = 0.35 * slope * Math.exp(-t / 6)
      const decline = (m < 0.6 ? (0.6 - m) * 0.03 * s : 0) + trt.recovery * s
      s = clamp(s + DT * (growth + momentum - decline), 0, MAX_SEVERITY)
    }
    means.push(s)
  }
  return { means, weatherPressure: mean(multipliers) }
}

function sigmaAt(day: number, input: ForecastInput) {
  const imagePenalty = 1 + 0.8 * (1 - input.imageConfidence)
  const historyPenalty = input.history.length === 0 ? 1.3 : 1
  const weatherPenalty = input.weatherIsSimulated ? 1.08 : 1
  return (0.08 + 0.05 * day ** 0.75) * imagePenalty * historyPenalty * weatherPenalty
}

export function runForecast(input: ForecastInput): Forecast {
  const { means, weatherPressure } = simulateMean(input)

  const trajectory: TrajectoryPoint[] = means.map((m, day) => {
    const sd = day === 0 ? 0.05 : sigmaAt(day, input)
    return {
      day,
      mean: round(m, 2),
      lower: round(clamp(m - Z90 * sd, 0, MAX_SEVERITY), 2),
      upper: round(clamp(m + Z90 * sd, 0, MAX_SEVERITY), 2),
    }
  })

  const horizons: HorizonForecast[] = ([3, 7, 14] as Horizon[]).map((h) => {
    const sd = sigmaAt(h, input)
    return {
      horizon: h,
      mean: round(means[h], 2),
      lower: trajectory[h].lower,
      upper: trajectory[h].upper,
      sigma: round(sd, 3),
      confidence: round(clamp(1 - sd, 0.05, 0.99), 2),
    }
  })

  const s0 = input.currentSeverity
  const h14 = horizons[2]
  const progressionRisk = round(1 - normCdf((s0 + 0.5 - h14.mean) / h14.sigma), 2)
  const delta7 = horizons[1].mean - s0
  const direction = delta7 > 0.25 ? 'worsening' : delta7 < -0.25 ? 'improving' : 'stable'

  return { horizons, trajectory, progressionRisk, direction, weatherPressure: round(weatherPressure, 2) }
}
