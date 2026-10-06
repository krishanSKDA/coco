import { cn } from '@/lib/utils'

export function ProbabilityBars({ items, highlight, colorFor }: { items: { key: string; label: string; value: number }[]; highlight?: string; colorFor?: (key: string) => string }) {
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.key} className="grid grid-cols-[7.5rem_1fr_2.75rem] items-center gap-2 text-xs">
          <span className={cn('truncate', it.key === highlight ? 'font-semibold text-stone-900' : 'text-stone-600')}>{it.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full" style={{ width: `${it.value * 100}%`, backgroundColor: colorFor?.(it.key) ?? (it.key === highlight ? '#15803d' : '#a8a29e') }} />
          </div>
          <span className="text-right text-stone-700 tabular-nums">{Math.round(it.value * 100)}%</span>
        </div>
      ))}
    </div>
  )
}
