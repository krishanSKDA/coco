import type { WeatherContext } from '@/types'
import { WEATHER_FEATURE_META } from '@/lib/weather'
import { WEATHER_SOURCE_LABEL } from '@/services/weatherService'
import { Badge } from '@/components/ui/Badges'

export function WeatherFeatureTable({ weather }: { weather: WeatherContext }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-stone-500">Window features (Table 4) – preceding window vs next 7 days</p>
        <Badge tone={weather.source === 'simulated' ? 'neutral' : 'blue'}>{WEATHER_SOURCE_LABEL[weather.source]}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="py-1.5 pr-3 font-medium">Feature</th>
              <th className="py-1.5 pr-3 text-right font-medium">Observed</th>
              <th className="py-1.5 text-right font-medium">Forecast</th>
            </tr>
          </thead>
          <tbody>
            {WEATHER_FEATURE_META.filter((m) => m.key !== 'rain14' && m.key !== 'wetDays14').map((m) => (
              <tr key={m.key} className="border-b border-stone-100 last:border-0">
                <td className="py-1.5 pr-3 text-stone-700">{m.label}</td>
                <td className="py-1.5 pr-3 text-right text-stone-900 tabular-nums">
                  {weather.window[m.key]} <span className="text-xs text-stone-400">{m.unit}</span>
                </td>
                <td className="py-1.5 text-right text-stone-900 tabular-nums">
                  {weather.forecastWindow[m.key]} <span className="text-xs text-stone-400">{m.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
