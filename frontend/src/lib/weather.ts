import type { AgroZone, DailyWeather, WeatherWindowFeatures } from '@/types'
import { addDays, clamp, gaussian, hashString, isoDate, mean, mulberry32, round, sum } from './utils'

const WET_DAY_MM = 1.0

/**
 * Climatological rainfall (mm/day) by month for Sri Lankan agro-zones.
 * Coarse approximation of the SW monsoon (May–Sep), second inter-monsoon
 * (Oct–Nov, wettest island-wide) and NE monsoon (Dec–Feb).
 */
const MONTHLY_RAIN: Record<AgroZone, number[]> = {
  //      Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct   Nov   Dec
  wet: [3.0, 2.8, 4.2, 8.0, 11.0, 8.5, 5.5, 4.5, 7.0, 12.0, 11.0, 5.5],
  intermediate: [3.5, 2.2, 3.2, 6.5, 5.5, 3.0, 2.2, 2.0, 3.5, 9.5, 9.0, 5.5],
  dry: [4.5, 1.8, 2.0, 4.0, 2.5, 0.8, 1.0, 1.2, 2.0, 7.5, 9.5, 7.0],
}

const zoneTempOffset: Record<AgroZone, number> = { wet: -0.4, intermediate: 0, dry: 0.8 }
const zoneRhOffset: Record<AgroZone, number> = { wet: 4, intermediate: 0, dry: -6 }

/** Deterministic synthetic daily weather – used offline or when APIs fail. */
export function syntheticDay(lat: number, lon: number, date: Date, zone: AgroZone): DailyWeather {
  const key = `${lat.toFixed(2)}|${lon.toFixed(2)}|${isoDate(date)}`
  const rand = mulberry32(hashString(key))
  const m = date.getMonth()
  const climRain = MONTHLY_RAIN[zone][m]

  // Rain occurrence + gamma-like amount
  const pWet = clamp(climRain / 12, 0.08, 0.85)
  const isWet = rand() < pWet
  const rain = isWet ? round(Math.max(0.5, -Math.log(Math.max(rand(), 1e-6)) * (climRain / pWet)), 1) : 0

  const seasonalT = 27.6 + 0.9 * Math.sin(((m - 1) / 12) * 2 * Math.PI) + zoneTempOffset[zone]
  const tMean = round(seasonalT - (isWet ? 0.9 : 0) + gaussian(rand) * 0.5, 1)
  const range = isWet ? 5.5 + rand() * 1.5 : 7 + rand() * 2.5
  const rhMean = round(clamp(76 + zoneRhOffset[zone] + (isWet ? 8 : -2) + climRain * 0.6 + gaussian(rand) * 3, 55, 98), 0)

  return {
    date: isoDate(date),
    rain,
    rhMean,
    rhMax: round(clamp(rhMean + 8 + rand() * 6, rhMean, 100), 0),
    tMean,
    tMin: round(tMean - range / 2, 1),
    tMax: round(tMean + range / 2, 1),
    wind: round(clamp(2.2 + (m >= 4 && m <= 8 ? 1.4 : 0) + gaussian(rand) * 0.6, 0.4, 7), 1),
  }
}

export function syntheticSeries(lat: number, lon: number, zone: AgroZone, start: Date, days: number): DailyWeather[] {
  return Array.from({ length: days }, (_, i) => syntheticDay(lat, lon, addDays(start, i), zone))
}

/** Leaf-wetness proxy in estimated hours/day (wetness duration is rarely measured). */
export function leafWetnessHours(d: DailyWeather) {
  const rhPart = clamp((d.rhMean - 75) / 20, 0, 1) * 10
  const rainPart = d.rain >= WET_DAY_MM ? 6 + Math.min(d.rain, 30) / 10 : 0
  return clamp(rhPart + rainPart, 0, 20)
}

/**
 * Table 4 – aggregate daily records into window features.
 * `days` must be ordered oldest → newest; windows are taken from the end.
 */
export function windowFeatures(days: DailyWeather[]): WeatherWindowFeatures {
  const last = (n: number) => days.slice(-n)
  const w7 = last(7)
  const w14 = last(14)
  return {
    rain3: round(sum(last(3).map((d) => d.rain)), 1),
    rain7: round(sum(w7.map((d) => d.rain)), 1),
    rain14: round(sum(w14.map((d) => d.rain)), 1),
    rhMean7: round(mean(w7.map((d) => d.rhMean)), 1),
    rhMax7: round(Math.max(...w7.map((d) => d.rhMax)), 0),
    tMean7: round(mean(w7.map((d) => d.tMean)), 1),
    tMin7: round(Math.min(...w7.map((d) => d.tMin)), 1),
    tMax7: round(Math.max(...w7.map((d) => d.tMax)), 1),
    tRange7: round(mean(w7.map((d) => d.tMax - d.tMin)), 1),
    wetDays7: w7.filter((d) => d.rain >= WET_DAY_MM).length,
    wetDays14: w14.filter((d) => d.rain >= WET_DAY_MM).length,
    leafWetness7: round(mean(w7.map(leafWetnessHours)), 1),
    wind7: round(mean(w7.map((d) => d.wind)), 1),
  }
}

/** Forecast-side aggregates computed over the first `horizon` forecast days. */
export function forecastWindowFeatures(forecast: DailyWeather[], horizon = 7) {
  return windowFeatures(forecast.slice(0, horizon))
}

export const WEATHER_FEATURE_META: { key: keyof WeatherWindowFeatures; label: string; unit: string }[] = [
  { key: 'rain3', label: 'Cumulative rainfall (3 d)', unit: 'mm' },
  { key: 'rain7', label: 'Cumulative rainfall (7 d)', unit: 'mm' },
  { key: 'rain14', label: 'Cumulative rainfall (14 d)', unit: 'mm' },
  { key: 'rhMean7', label: 'Mean relative humidity', unit: '%' },
  { key: 'rhMax7', label: 'Max relative humidity', unit: '%' },
  { key: 'tMean7', label: 'Mean temperature', unit: '°C' },
  { key: 'tMin7', label: 'Min temperature', unit: '°C' },
  { key: 'tMax7', label: 'Max temperature', unit: '°C' },
  { key: 'tRange7', label: 'Mean diurnal range', unit: '°C' },
  { key: 'wetDays7', label: 'Wet days (7 d)', unit: 'days' },
  { key: 'wetDays14', label: 'Wet days (14 d)', unit: 'days' },
  { key: 'leafWetness7', label: 'Leaf-wetness proxy', unit: 'h/day' },
  { key: 'wind7', label: 'Mean wind speed', unit: 'm/s' },
]
