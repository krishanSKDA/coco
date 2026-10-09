import type { ReactNode } from 'react'
import { Info, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export function ProgressBar({ value, color = '#15803d', className, height = 'h-1.5' }: { value: number; color?: string; className?: string; height?: string }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-stone-100', height, className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, backgroundColor: color }} />
    </div>
  )
}

export function ExpertNotice({ className }: { className?: string }) {
  const t = useT()
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900', className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <p>{t('expertNotice')}</p>
    </div>
  )
}

export function Callout({ tone = 'info', title, children, icon, className }: { tone?: 'info' | 'warn' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  const styles = {
    info: 'border-stone-200 bg-stone-50 text-stone-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone]
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', styles, className)}>
      <span className="mt-0.5 shrink-0">{icon ?? <Info className="size-4" />}</span>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-[13px] opacity-90')}>{children}</div>}
      </div>
    </div>
  )
}

export function KeyValue({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-medium text-stone-800 tabular-nums">{value}</span>
    </div>
  )
}

export function PrototypeTag({ children = 'Prototype model' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-violet-700 uppercase">
      {children}
    </span>
  )
}
