import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeatherContext } from '@/types'
import { formatDate } from '@/lib/utils'

/**
 * Small multiples (one measure per chart, shared x-axis) instead of a
 * dual-axis chart: rainfall, relative humidity and temperature.
 */
export function WeatherCharts({ weather }: { weather: WeatherContext }) {
  const today = weather.observed[weather.observed.length - 1]?.date
  const data = [
    ...weather.observed.map((d) => ({ ...d, phase: 'Observed' })),
    ...weather.forecast.map((d) => ({ ...d, phase: 'Forecast' })),
  ].map((d) => ({ ...d, label: formatDate(d.date, { day: 'numeric', month: 'short' }) }))
  const todayLabel = today ? formatDate(today, { day: 'numeric', month: 'short' }) : undefined

  const common = {
    data,
    margin: { top: 6, right: 8, bottom: 0, left: -22 },
    syncId: 'weather',
  }
  const xAxis = <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} interval={3} />
  const grid = <CartesianGrid stroke="#f0eeec" vertical={false} />
  const todayLine = todayLabel && <ReferenceLine x={todayLabel} stroke="#a8a29e" strokeDasharray="3 3" />
  const tooltip = (unit: string) => (
    <Tooltip
      contentStyle={{ fontSize: 11, padding: '4px 8px' }}
      formatter={(v, name) => [`${typeof v === 'number' ? v.toFixed(1) : v} ${unit}`, String(name)]}
      labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.phase ?? ''}`}
    />
  )

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Rainfall" unit="mm/day">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart {...common}>
            {grid}
            {xAxis}
            <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
            {tooltip('mm')}
            {todayLine}
            <Bar dataKey="rain" name="Rainfall" fill="#0284c7" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Relative humidity" unit="% (mean)">
        <ResponsiveContainer width="100%" height={150}>
          <LineChart {...common}>
            {grid}
            {xAxis}
            <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
            {tooltip('%')}
            {todayLine}
            <Line dataKey="rhMean" name="RH mean" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Temperature" unit="°C (mean)">
        <ResponsiveContainer width="100%" height={150}>
          <LineChart {...common}>
            {grid}
            {xAxis}
            <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={(v) => Number(v).toFixed(0)} />
            {tooltip('°C')}
            {todayLine}
            <Line dataKey="tMean" name="Temp mean" stroke="#c2410c" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

function Panel({ title, unit, children }: { title: string; unit: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-stone-700">
        {title} <span className="font-normal text-stone-400">· {unit}</span>
      </p>
      {children}
    </div>
  )
}
