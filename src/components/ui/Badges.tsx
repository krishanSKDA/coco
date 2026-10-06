import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { Forecast, InterventionCategory } from '@/types'
import { cn } from '@/lib/utils'
import { severityColor, severityLabel } from '@/lib/constants'
import { useT } from '@/i18n'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
}

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

const CAT_STYLE: Record<InterventionCategory, { tone: Tone; icon: ReactNode }> = {
  monitor: { tone: 'green', icon: <CheckCircle2 className="size-3.5" /> },
  prepare: { tone: 'amber', icon: <AlertTriangle className="size-3.5" /> },
  intervene: { tone: 'red', icon: <ShieldAlert className="size-3.5" /> },
}

export function CategoryBadge({ category, short = false, className }: { category: InterventionCategory; short?: boolean; className?: string }) {
  const t = useT()
  const shortLabel = { monitor: 'Monitor', prepare: 'Prepare', intervene: 'Intervene' }[category]
  return (
    <Badge tone={CAT_STYLE[category].tone} icon={CAT_STYLE[category].icon} className={className}>
      {short ? shortLabel : t(`cat_${category}`)}
    </Badge>
  )
}

export function SeverityPill({ value, showLabel = true, decimals = 0, className }: { value: number; showLabel?: boolean; decimals?: number; className?: string }) {
  const color = severityColor(value)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums', className)} style={{ backgroundColor: `${color}1f`, color }}>
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {value.toFixed(decimals)}
      {showLabel && <span className="font-medium opacity-90">· {severityLabel(value)}</span>}
    </span>
  )
}

export function TrendIndicator({ direction, className }: { direction: Forecast['direction']; className?: string }) {
  const map = {
    worsening: { icon: <TrendingUp className="size-4" />, cls: 'text-red-600', label: 'Worsening' },
    stable: { icon: <Minus className="size-4" />, cls: 'text-stone-500', label: 'Stable' },
    improving: { icon: <TrendingDown className="size-4" />, cls: 'text-emerald-600', label: 'Improving' },
  }[direction]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', map.cls, className)}>
      {map.icon}
      {map.label}
    </span>
  )
}
