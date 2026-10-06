import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  icon?: ReactNode
  count?: number
}

export function Tabs<K extends string>({ items, value, onChange, className }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-stone-200', className)}>
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
            value === it.key ? 'border-brand-700 text-brand-800' : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800',
          )}
        >
          {it.icon}
          {it.label}
          {it.count !== undefined && <span className="rounded-full bg-stone-100 px-1.5 text-xs text-stone-600">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}
