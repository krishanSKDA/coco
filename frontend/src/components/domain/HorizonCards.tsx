import type { Observation } from '@/types'
import { severityColor, severityLabel } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/Misc'

export function HorizonCards({ observation, confidenceThreshold }: { observation: Observation; confidenceThreshold: number }) {
  const s0 = observation.analysis.severity
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {observation.forecast.horizons.map((h) => {
        const delta = h.mean - s0
        const low = h.confidence < confidenceThreshold
        return (
          <div key={h.horizon} className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">t + {h.horizon} days</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums" style={{ color: severityColor(h.mean) }}>
                {h.mean.toFixed(1)}
              </span>
              <span className={cn('text-xs font-medium tabular-nums', delta > 0.05 ? 'text-red-600' : delta < -0.05 ? 'text-emerald-600' : 'text-stone-500')}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-stone-600">{severityLabel(h.mean)}</p>
            <p className="mt-1 text-[11px] text-stone-500 tabular-nums">
              90 % · {h.lower.toFixed(1)}–{h.upper.toFixed(1)}
            </p>
            <div className="mt-2">
              <div className="mb-0.5 flex justify-between text-[10px] text-stone-500">
                <span>Confidence</span>
                <span className={cn('font-semibold tabular-nums', low ? 'text-amber-700' : 'text-stone-700')}>{Math.round(h.confidence * 100)}%</span>
              </div>
              <ProgressBar value={h.confidence} color={low ? '#d97706' : '#15803d'} />
              {low && <p className="mt-1 text-[10px] font-medium text-amber-700">Low confidence – expert check</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
