import type { Attribution } from '@/types'
import { cn } from '@/lib/utils'

const GROUP_LABEL: Record<Attribution['group'], string> = {
  image: 'Image',
  weather: 'Weather',
  history: 'History',
  treatment: 'Treatment',
  context: 'Context',
}

/**
 * Diverging horizontal bars around a zero baseline (SHAP-style).
 * Red = pushes severity up, green = holds it down; the sign is also spelled
 * out in text so meaning is never colour-alone.
 */
export function AttributionBars({ items, max = 8 }: { items: Attribution[]; max?: number }) {
  const shown = items.slice(0, max)
  const scale = Math.max(0.2, ...shown.map((a) => Math.abs(a.contribution)))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-stone-500">
        <span>← holds severity down</span>
        <span>Δ 7-day forecast (severity units)</span>
        <span>pushes severity up →</span>
      </div>
      {shown.map((a) => {
        const w = (Math.abs(a.contribution) / scale) * 50
        const up = a.contribution > 0
        return (
          <div key={a.feature} className="group grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm" title={a.statement}>
            <div className="min-w-0">
              <p className="truncate font-medium text-stone-800">{a.label}</p>
              <p className="truncate text-[11px] text-stone-500">
                <span className="mr-1 rounded bg-stone-100 px-1 text-stone-600">{GROUP_LABEL[a.group]}</span>
                {a.displayValue}
              </p>
            </div>
            <div className="relative h-5 rounded bg-stone-50">
              <div className="absolute inset-y-0 left-1/2 w-px bg-stone-300" />
              <div
                className={cn('absolute inset-y-0.5 rounded-sm transition-all group-hover:opacity-80', up ? 'bg-red-500' : 'bg-emerald-600')}
                style={up ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
              />
            </div>
            <span className={cn('text-right text-xs font-semibold tabular-nums', up ? 'text-red-700' : 'text-emerald-700')}>
              {up ? '+' : '−'}
              {Math.abs(a.contribution).toFixed(2)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
