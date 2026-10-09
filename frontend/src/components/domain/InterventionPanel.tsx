import { AlertTriangle, CheckCircle2, ShieldAlert, Clock, Info } from 'lucide-react'
import type { Observation } from '@/types'
import { INTERVENTION } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { ExpertNotice } from '@/components/ui/Misc'

const STYLE = {
  monitor: { wrap: 'border-emerald-200 bg-emerald-50', icon: <CheckCircle2 className="size-7 text-emerald-600" />, title: 'text-emerald-900', step: 'bg-emerald-600' },
  prepare: { wrap: 'border-amber-200 bg-amber-50', icon: <AlertTriangle className="size-7 text-amber-600" />, title: 'text-amber-900', step: 'bg-amber-500' },
  intervene: { wrap: 'border-red-200 bg-red-50', icon: <ShieldAlert className="size-7 text-red-600" />, title: 'text-red-900', step: 'bg-red-600' },
}

export function InterventionPanel({ observation }: { observation: Observation }) {
  const t = useT()
  const { decision } = observation
  const s = STYLE[decision.category]
  const meta = INTERVENTION[decision.category]

  return (
    <div className={cn('rounded-xl border p-4 sm:p-5', s.wrap)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex flex-1 items-start gap-3">
          <div className="rounded-full bg-white p-2 shadow-xs">{s.icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('interventionWindow')}</p>
            <h2 className={cn('text-lg font-semibold sm:text-xl', s.title)}>{t(`cat_${decision.category}`)}</h2>
            <p className="mt-1 text-sm text-stone-700">{meta.action}</p>
            <ul className="mt-2 space-y-1 text-[13px] text-stone-600">
              {decision.reasons.map((r) => (
                <li key={r} className="flex gap-1.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-stone-400" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 flex-row gap-2 md:flex-col md:items-end">
          <CategoryScale active={decision.category} />
          {decision.crossingDay !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-700 shadow-xs">
              <Clock className="size-3.5" />
              {decision.crossingDay === 0 ? 'At threshold now' : `Threshold reached in ~${decision.crossingDay} days`}
            </span>
          )}
        </div>
      </div>
      {(decision.conservativeFallback || decision.lowConfidence) && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-stone-700">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {decision.conservativeFallback
            ? 'Forecast uncertainty is high, so the system has fallen back to the more conservative category.'
            : 'At least one horizon has low confidence – treat the longer-range figures as indicative and confirm with an expert.'}
        </div>
      )}
      <ExpertNotice className="mt-3" />
    </div>
  )
}

function CategoryScale({ active }: { active: Observation['decision']['category'] }) {
  const cats = ['monitor', 'prepare', 'intervene'] as const
  return (
    <div className="flex items-center gap-1" aria-label="Category scale">
      {cats.map((c) => (
        <span
          key={c}
          className={cn(
            'rounded px-2 py-1 text-[11px] font-semibold',
            c === active ? cn(STYLE[c].step, 'text-white shadow-xs') : 'bg-white/70 text-stone-400',
          )}
        >
          {INTERVENTION[c].short}
        </span>
      ))}
    </div>
  )
}
