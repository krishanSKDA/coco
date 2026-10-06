import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, Camera, CloudRain, Map, ShieldAlert, AlertTriangle, ChevronRight } from 'lucide-react'
import { latestObservation, useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, CardHeader, CardBody, StatCard, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { CategoryBadge, SeverityPill, TrendIndicator } from '@/components/ui/Badges'
import { CATEGORY_RANK, INTERVENTION } from '@/lib/constants'
import { relativeTime } from '@/lib/utils'
import type { InterventionCategory } from '@/types'

const CAT_COLOR: Record<InterventionCategory, string> = { monitor: '#059669', prepare: '#d97706', intervene: '#dc2626' }

export default function Dashboard() {
  const navigate = useNavigate()
  const plots = useAppStore((s) => s.plots)
  const observations = useAppStore((s) => s.observations)
  const alerts = useAppStore((s) => s.alerts)
  const role = useAppStore((s) => s.settings.role)

  const rows = useMemo(
    () =>
      plots
        .map((p) => ({ plot: p, obs: latestObservation(observations, p.id) }))
        .sort((a, b) => {
          if (!a.obs) return 1
          if (!b.obs) return -1
          const r = CATEGORY_RANK[b.obs.decision.category] - CATEGORY_RANK[a.obs.decision.category]
          return r !== 0 ? r : b.obs.forecast.horizons[1].mean - a.obs.forecast.horizons[1].mean
        }),
    [plots, observations],
  )

  const counts = rows.reduce(
    (acc, r) => {
      if (r.obs) acc[r.obs.decision.category]++
      return acc
    },
    { monitor: 0, prepare: 0, intervene: 0 } as Record<InterventionCategory, number>,
  )
  const assessed = counts.monitor + counts.prepare + counts.intervene
  const unread = alerts.filter((a) => !a.read)
  const plotName = (id: string) => plots.find((p) => p.id === id)?.name ?? id

  return (
    <>
      <PageHeader
        title={role === 'officer' ? 'Extension officer dashboard' : 'My plots overview'}
        subtitle="Plot-level forecasts, intervention windows and alerts across monitored coconut plots."
        actions={
          <>
            <ButtonLink to="/plots/new" variant="secondary" icon={<Map className="size-4" />}>
              Register plot
            </ButtonLink>
            <ButtonLink to="/assess" icon={<Camera className="size-4" />}>
              New assessment
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Plots monitored" value={plots.length} hint={`${observations.length} observations recorded`} icon={<Map className="size-5" />} />
        <StatCard
          label="Intervene"
          value={counts.intervene}
          hint="Expert-confirmed action needed"
          icon={<ShieldAlert className="size-5" />}
          accent="text-red-700 bg-red-50"
        />
        <StatCard
          label="Prepare"
          value={counts.prepare}
          hint="Threshold within 14 days"
          icon={<AlertTriangle className="size-5" />}
          accent="text-amber-700 bg-amber-50"
        />
        <StatCard label="Unread alerts" value={unread.length} hint="Escalations since last review" icon={<Bell className="size-5" />} accent="text-sky-700 bg-sky-50" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Plots by urgency" subtitle="Sorted by intervention category, then 7-day forecast" />
          {rows.length === 0 ? (
            <CardBody>
              <EmptyState title="No plots yet" description="Register a plot to start building its disease history." action={<ButtonLink to="/plots/new">Register plot</ButtonLink>} />
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                    <th className="px-5 py-2 font-medium">Plot</th>
                    <th className="px-2 py-2 font-medium">Now</th>
                    <th className="px-2 py-2 text-center font-medium">t+3</th>
                    <th className="px-2 py-2 text-center font-medium">t+7</th>
                    <th className="px-2 py-2 text-center font-medium">t+14</th>
                    <th className="px-2 py-2 font-medium">Trend</th>
                    <th className="px-2 py-2 font-medium">Window</th>
                    <th className="px-2 py-2 font-medium">Last seen</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ plot, obs }) => (
                    <tr key={plot.id} onClick={() => navigate(`/plots/${plot.id}`)} className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50">
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-stone-900">{plot.name}</p>
                        <p className="text-xs text-stone-500">
                          {plot.id} · {plot.district}
                        </p>
                      </td>
                      {obs ? (
                        <>
                          <td className="px-2 py-2.5">
                            <SeverityPill value={obs.analysis.severity} showLabel={false} />
                          </td>
                          {obs.forecast.horizons.map((h) => (
                            <td key={h.horizon} className="px-2 py-2.5 text-center">
                              <SeverityPill value={h.mean} decimals={1} showLabel={false} />
                            </td>
                          ))}
                          <td className="px-2 py-2.5">
                            <TrendIndicator direction={obs.forecast.direction} />
                          </td>
                          <td className="px-2 py-2.5">
                            <CategoryBadge category={obs.decision.category} short />
                          </td>
                          <td className="px-2 py-2.5 text-xs whitespace-nowrap text-stone-500">{relativeTime(obs.timestamp)}</td>
                        </>
                      ) : (
                        <td colSpan={7} className="px-2 py-2.5 text-xs text-stone-500">
                          No observations yet
                        </td>
                      )}
                      <td className="pr-3 text-stone-400">
                        <ChevronRight className="size-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Intervention windows" subtitle={`${assessed} assessed plots`} />
            <CardBody>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                {(['intervene', 'prepare', 'monitor'] as const).map((c) =>
                  counts[c] ? <div key={c} style={{ flex: counts[c], backgroundColor: CAT_COLOR[c] }} title={`${INTERVENTION[c].short}: ${counts[c]}`} /> : null,
                )}
              </div>
              <ul className="mt-4 space-y-2.5">
                {(['intervene', 'prepare', 'monitor'] as const).map((c) => (
                  <li key={c} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-stone-700">
                      <span className="size-2.5 rounded-sm" style={{ backgroundColor: CAT_COLOR[c] }} />
                      {INTERVENTION[c].label}
                    </span>
                    <span className="font-semibold text-stone-900 tabular-nums">{counts[c]}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent alerts"
              action={
                <Link to="/alerts" className="text-xs font-medium text-brand-700 hover:underline">
                  View all
                </Link>
              }
            />
            <ul className="divide-y divide-stone-100">
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to={`/observations/${a.observationId}`} className="flex items-start gap-3 px-5 py-3 hover:bg-stone-50">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.read ? 'bg-stone-300' : 'bg-red-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{plotName(a.plotId)}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <CategoryBadge category={a.to} short />
                        <span className="text-xs text-stone-500">{relativeTime(a.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              {alerts.length === 0 && <li className="px-5 py-6 text-center text-sm text-stone-500">No alerts</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Weather pressure by plot"
          subtitle="Mean disease-conducive weather multiplier over the forecast window (1.0 = neutral). Driven by RH, rainfall, temperature and wetness [5]."
          icon={<CloudRain className="size-4" />}
        />
        <CardBody className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {rows
            .filter((r) => r.obs)
            .map(({ plot, obs }) => {
              const wp = obs!.forecast.weatherPressure
              return (
                <div key={plot.id} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate text-stone-700">{plot.name}</span>
                  <div className="relative h-2 rounded-full bg-stone-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-sky-600" style={{ width: `${Math.min(100, (wp / 2) * 100)}%` }} />
                    <div className="absolute -inset-y-1 left-1/2 w-px bg-stone-400" title="Neutral (1.0)" />
                  </div>
                  <span className="text-right font-medium text-stone-800 tabular-nums">{wp.toFixed(2)}</span>
                </div>
              )
            })}
        </CardBody>
      </Card>
    </>
  )
}
