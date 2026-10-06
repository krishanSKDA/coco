import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bell, CheckCheck } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CategoryBadge } from '@/components/ui/Badges'
import { Tabs } from '@/components/ui/Tabs'
import { formatDateTime, relativeTime } from '@/lib/utils'

export default function Alerts() {
  const alerts = useAppStore((s) => s.alerts)
  const plots = useAppStore((s) => s.plots)
  const markRead = useAppStore((s) => s.markAlertRead)
  const markAll = useAppStore((s) => s.markAllAlertsRead)
  const [tab, setTab] = useState<'unread' | 'all'>('unread')

  const list = [...alerts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).filter((a) => tab === 'all' || !a.read)
  const unread = alerts.filter((a) => !a.read).length

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Raised when a plot moves into a more urgent intervention window (FR-17)."
        actions={
          unread > 0 && (
            <Button variant="secondary" size="sm" onClick={markAll} icon={<CheckCheck className="size-4" />}>
              Mark all read
            </Button>
          )
        }
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'unread', label: 'Unread', count: unread },
          { key: 'all', label: 'All', count: alerts.length },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title={tab === 'unread' ? 'You are all caught up' : 'No alerts yet'} description="New escalations will appear here." />
      ) : (
        <Card>
          <ul className="divide-y divide-stone-100">
            {list.map((a) => {
              const plot = plots.find((p) => p.id === a.plotId)
              return (
                <li key={a.id} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${a.read ? '' : 'bg-red-50/30'}`}>
                  <span className={`hidden size-2.5 shrink-0 rounded-full sm:block ${a.read ? 'bg-stone-300' : 'bg-red-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-900">{plot?.name ?? a.plotId}</p>
                      {a.from && (
                        <>
                          <CategoryBadge category={a.from} short />
                          <ArrowRight className="size-3.5 text-stone-400" />
                        </>
                      )}
                      <CategoryBadge category={a.to} short />
                    </div>
                    <p className="mt-1 text-sm text-stone-600">{a.message}</p>
                    <p className="mt-0.5 text-xs text-stone-400" title={formatDateTime(a.createdAt)}>
                      {relativeTime(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!a.read && (
                      <Button variant="ghost" size="sm" onClick={() => markRead(a.id)}>
                        Mark read
                      </Button>
                    )}
                    <Link
                      to={`/observations/${a.observationId}`}
                      onClick={() => markRead(a.id)}
                      className="inline-flex h-8 items-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
                    >
                      View assessment
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
