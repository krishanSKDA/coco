import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { MapPin, Plus, Search, Trees } from 'lucide-react'
import { plotObservations, useAppStore } from '@/store/useAppStore'
import { PageHeader, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { CategoryBadge, SeverityPill, TrendIndicator } from '@/components/ui/Badges'
import { SeveritySparkline } from '@/components/charts/Sparkline'
import { relativeTime } from '@/lib/utils'
import type { InterventionCategory } from '@/types'

export default function Plots() {
  const plots = useAppStore((s) => s.plots)
  const observations = useAppStore((s) => s.observations)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<InterventionCategory | 'all'>('all')

  const items = useMemo(
    () =>
      plots
        .map((p) => {
          const hist = plotObservations(observations, p.id)
          return { plot: p, hist, latest: hist[hist.length - 1] }
        })
        .filter(({ plot, latest }) => {
          const text = `${plot.name} ${plot.id} ${plot.district} ${plot.owner}`.toLowerCase()
          return text.includes(q.toLowerCase()) && (cat === 'all' || latest?.decision.category === cat)
        }),
    [plots, observations, q, cat],
  )

  return (
    <>
      <PageHeader
        title="Plots"
        subtitle="Every observation is linked to a persistent plot identifier so disease history can be tracked over time (FR-01)."
        actions={
          <ButtonLink to="/plots/new" icon={<Plus className="size-4" />}>
            Register plot
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search by name, ID, district or owner" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-56" value={cat} onChange={(e) => setCat(e.target.value as InterventionCategory | 'all')}>
          <option value="all">All intervention windows</option>
          <option value="intervene">Intervene</option>
          <option value="prepare">Prepare</option>
          <option value="monitor">Monitor</option>
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Trees className="size-6" />} title="No plots match" description="Try a different search or register a new plot." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ plot, hist, latest }) => (
            <Link key={plot.id} to={`/plots/${plot.id}`} className="card card-pad group flex flex-col transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900 group-hover:text-brand-800">{plot.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                    <MapPin className="size-3" />
                    {plot.district} · {plot.id}
                  </p>
                </div>
                {latest && <CategoryBadge category={latest.decision.category} short />}
              </div>
              {latest ? (
                <>
                  <div className="mt-3 -mx-1">
                    <SeveritySparkline history={hist} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-stone-500">
                      Now <SeverityPill value={latest.analysis.severity} />
                    </span>
                    <span className="flex items-center gap-2 text-stone-500">
                      t+7 <SeverityPill value={latest.forecast.horizons[1].mean} decimals={1} showLabel={false} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs text-stone-500">
                    <TrendIndicator direction={latest.forecast.direction} />
                    <span>
                      {hist.length} obs · {relativeTime(latest.timestamp)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-6 text-sm text-stone-500">No observations yet – run a first assessment.</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
