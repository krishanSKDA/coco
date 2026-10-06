import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Observation } from '@/types'
import { addDays, formatDate } from '@/lib/utils'
import { SEVERITY_SCALE, severityLabel } from '@/lib/constants'

interface Props {
  history: Observation[] // ordered oldest → newest; last one owns the forecast
  threshold: number
  height?: number
  showHorizonMarkers?: boolean
}

interface Point {
  t: number
  observed?: number
  mean?: number
  band?: [number, number]
  horizon?: number
}

const OBS_COLOR = '#292524'
const FC_COLOR = '#0369a1'

export function ForecastChart({ history, threshold, height = 300, showHorizonMarkers = true }: Props) {
  if (!history.length) return null
  const latest = history[history.length - 1]
  const t0 = new Date(latest.timestamp)

  const points: Point[] = history.slice(0, -1).map((o) => ({ t: +new Date(o.timestamp), observed: o.analysis.severity }))
  latest.forecast.trajectory.forEach((p) => {
    points.push({
      t: +addDays(t0, p.day),
      observed: p.day === 0 ? latest.analysis.severity : undefined,
      mean: p.mean,
      band: [p.lower, p.upper],
      horizon: [3, 7, 14].includes(p.day) ? p.day : undefined,
    })
  })

  const tStart = points[0].t
  const tEnd = points[points.length - 1].t

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
        <LegendSwatch color={OBS_COLOR} label="Observed severity" />
        <LegendSwatch color={FC_COLOR} label="Forecast (mean)" dashed />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: `${FC_COLOR}26` }} />
          90 % interval
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dotted border-red-500" />
          Action threshold ({threshold})
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#f0eeec" vertical={false} />
          <ReferenceArea x1={+t0} x2={tEnd} fill="#f8fafc" fillOpacity={1} ifOverflow="extendDomain" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[tStart, tEnd]}
            tickFormatter={(v) => formatDate(new Date(v), { day: 'numeric', month: 'short' })}
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickLine={false}
            axisLine={{ stroke: '#e7e5e4' }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 4]}
            ticks={[0, 1, 2, 3, 4]}
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ForecastTooltip t0={+t0} />} cursor={{ stroke: '#a8a29e', strokeDasharray: '3 3' }} />
          <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="2 4" strokeWidth={1.5} />
          <ReferenceLine x={+t0} stroke="#a8a29e" strokeDasharray="3 3" label={{ value: 'Today', position: 'insideTopLeft', fontSize: 10, fill: '#78716c' }} />
          <Area dataKey="band" stroke="none" fill={FC_COLOR} fillOpacity={0.15} isAnimationActive={false} connectNulls />
          <Line dataKey="mean" stroke={FC_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
          <Line
            dataKey="observed"
            stroke={OBS_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: '#fff', stroke: OBS_COLOR, strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
          {showHorizonMarkers &&
            latest.forecast.horizons.map((h) => (
              <ReferenceDot
                key={h.horizon}
                x={+addDays(t0, h.horizon)}
                y={h.mean}
                r={5}
                fill={FC_COLOR}
                stroke="#fff"
                strokeWidth={2}
                label={{ value: `t+${h.horizon}`, position: 'top', fontSize: 10, fill: '#0c4a6e', fontWeight: 600 }}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0 w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      {label}
    </span>
  )
}

interface TooltipPayload {
  payload: Point
}

function ForecastTooltip({ active, payload, t0 }: { active?: boolean; payload?: TooltipPayload[]; t0: number }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const day = Math.round((p.t - t0) / 86_400_000)
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-stone-900">
        {formatDate(new Date(p.t), { weekday: 'short', day: 'numeric', month: 'short' })}
        {day > 0 && <span className="ml-1 text-stone-500">(t+{day})</span>}
      </p>
      {p.observed !== undefined && (
        <p className="mt-1 text-stone-700">
          Observed: <b className="tabular-nums">{p.observed}</b> · {severityLabel(p.observed)}
        </p>
      )}
      {p.mean !== undefined && day > 0 && (
        <>
          <p className="mt-1 text-stone-700">
            Forecast: <b className="tabular-nums">{p.mean.toFixed(2)}</b> · {SEVERITY_SCALE[Math.round(p.mean)].label}
          </p>
          {p.band && (
            <p className="text-stone-500 tabular-nums">
              90 % interval {p.band[0].toFixed(1)} – {p.band[1].toFixed(1)}
            </p>
          )}
        </>
      )}
    </div>
  )
}
