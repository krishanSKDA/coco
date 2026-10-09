import { Link } from 'react-router'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export function Logo({ compact = false }: { compact?: boolean }) {
  const t = useT()
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className={cn('rounded-lg', compact ? 'size-7' : 'size-9')} />
      <div className="leading-tight">
        <p className={cn('font-semibold', compact ? 'text-sm text-stone-900' : 'text-base text-white')}>{t('appName')}</p>
        {!compact && <p className="text-[11px] text-brand-200/80">{t('appTagline')}</p>}
      </div>
    </Link>
  )
}
