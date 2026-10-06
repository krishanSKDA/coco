/**
 * Weather retrieval (FR-07).
 *  - Observed window: NASA POWER daily point API (AG community) [21]
 *  - Forecast window: Open-Meteo daily forecast
 * Either source falls back to the deterministic synthetic generator when
 * offline, disabled, or when the API returns missing values.
 */
import type { AgroZone, DailyWeather, WeatherContext } from '@/types'
import { addDays, isoDate } from '@/lib/utils'
import { forecastWindowFeatures, syntheticSeries, windowFeatures } from '@/lib/weather'

const TIMEOUT_MS = 6000

async function fetchJson(url: string) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

const ymd = (d: Date) => isoDate(d).replaceAll('-', '')

async function fetchNasaPower(lat: number, lon: number, start: Date, end: Date): Promise<Map<string, Partial<DailyWeather>>> {
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,RH2M,T2M,T2M_MAX,T2M_MIN,WS2M` +
    `&community=AG&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`
  const json = await fetchJson(url)
  const p = json?.properties?.parameter
  if (!p) throw new Error('Unexpected NASA POWER response')
  const out = new Map<string, Partial<DailyWeather>>()
  const ok = (v: unknown) => typeof v === 'number' && v > -900
  for (const key of Object.keys(p.T2M ?? {})) {
    const date = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`
    const rec: Partial<DailyWeather> = { date }
    if (ok(p.PRECTOTCORR?.[key])) rec.rain = p.PRECTOTCORR[key]
    if (ok(p.RH2M?.[key])) {
      rec.rhMean = p.RH2M[key]
      rec.rhMax = Math.min(100, p.RH2M[key] + 9)
    }
    if (ok(p.T2M?.[key])) rec.tMean = p.T2M[key]
    if (ok(p.T2M_MAX?.[key])) rec.tMax = p.T2M_MAX[key]
    if (ok(p.T2M_MIN?.[key])) rec.tMin = p.T2M_MIN[key]
    if (ok(p.WS2M?.[key])) rec.wind = p.WS2M[key]
    out.set(date, rec)
  }
  return out
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<Map<string, Partial<DailyWeather>>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,relative_humidity_2m_max,wind_speed_10m_mean` +
    `&forecast_days=16&timezone=Asia%2FColombo&wind_speed_unit=ms`
  const json = await fetchJson(url)
  const d = json?.daily
  if (!d?.time) throw new Error('Unexpected Open-Meteo response')
  const out = new Map<string, Partial<DailyWeather>>()
  d.time.forEach((date: string, i: number) => {
    const rec: Partial<DailyWeather> = { date }
    const set = <K extends keyof DailyWeather>(k: K, v: unknown) => {
      if (typeof v === 'number') rec[k] = v as DailyWeather[K]
    }
    set('rain', d.precipitation_sum?.[i])
    set('tMean', d.temperature_2m_mean?.[i])
    set('tMax', d.temperature_2m_max?.[i])
    set('tMin', d.temperature_2m_min?.[i])
    set('rhMean', d.relative_humidity_2m_mean?.[i])
    set('rhMax', d.relative_humidity_2m_max?.[i])
    // 10 m wind → approx. 2 m wind (log profile factor ≈ 0.75)
    if (typeof d.wind_speed_10m_mean?.[i] === 'number') rec.wind = d.wind_speed_10m_mean[i] * 0.75
    out.set(date, rec)
  })
  return out
}

function merge(base: DailyWeather[], live: Map<string, Partial<DailyWeather>> | null) {
  let used = 0
  const merged = base.map((d) => {
    const l = live?.get(d.date)
    if (!l) return d
    const complete = l.rain !== undefined && l.tMean !== undefined && l.rhMean !== undefined
    if (complete) used++
    return { ...d, ...l } as DailyWeather
  })
  return { merged, coverage: base.length ? used / base.length : 0 }
}

export async function getWeatherContext(opts: {
  lat: number
  lon: number
  zone: AgroZone
  date: Date
  live: boolean
}): Promise<WeatherContext> {
  const { lat, lon, zone, date, live } = opts
  const obsStart = addDays(date, -13)
  const fcStart = addDays(date, 1)
  let observed = syntheticSeries(lat, lon, zone, obsStart, 14)
  let forecast = syntheticSeries(lat, lon, zone, fcStart, 14)
  let source: WeatherContext['source'] = 'simulated'

  if (live && typeof navigator !== 'undefined' && navigator.onLine) {
    const [nasa, om] = await Promise.allSettled([fetchNasaPower(lat, lon, obsStart, date), fetchOpenMeteo(lat, lon)])
    const obs = merge(observed, nasa.status === 'fulfilled' ? nasa.value : null)
    // Open-Meteo also covers the most recent days NASA POWER has not yet published
    const obs2 = merge(obs.merged, om.status === 'fulfilled' ? om.value : null)
    const fc = merge(forecast, om.status === 'fulfilled' ? om.value : null)
    observed = obs2.merged
    forecast = fc.merged
    const nasaOk = obs.coverage > 0.5
    const omOk = fc.coverage > 0.5
    source = nasaOk && omOk ? 'mixed' : nasaOk ? 'nasa-power' : omOk ? 'open-meteo' : 'simulated'
  }

  return {
    source,
    observed,
    forecast,
    window: windowFeatures(observed),
    forecastWindow: forecastWindowFeatures(forecast, 7),
  }
}

export const WEATHER_SOURCE_LABEL: Record<WeatherContext['source'], string> = {
  'nasa-power': 'NASA POWER (observed) + simulated forecast',
  'open-meteo': 'Simulated history + Open-Meteo forecast',
  mixed: 'NASA POWER + Open-Meteo',
  simulated: 'Simulated (offline / demo)',
}
