import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import type { Observation } from '@/types'
import { formatDate } from '@/lib/utils'

/** Compact severity history + forecast mean for plot cards. */
export function SeveritySparkline({ history, height = 44 }: { history: Observation[]; height?: number }) {
  if (!history.length) return null
  const latest = history[history.length - 1]
  const data = [
    ...history.map((o) => ({ label: formatDate(o.timestamp, { day: 'numeric', month: 'short' }), observed: o.analysis.severity as number | undefined, forecast: undefined as number | undefined })),
  ]
  data[data.length - 1].forecast = latest.analysis.severity
  latest.forecast.horizons.forEach((h) => data.push({ label: `t+${h.horizon}`, observed: undefined, forecast: h.mean }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <YAxis domain={[0, 4]} hide />
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '4px 8px' }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(v, name) => [typeof v === 'number' ? v.toFixed(1) : String(v), name === 'observed' ? 'Observed' : 'Forecast']}
        />
        <Line dataKey="observed" stroke="#292524" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} connectNulls />
        <Line dataKey="forecast" stroke="#0369a1" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
