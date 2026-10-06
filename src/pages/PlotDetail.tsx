import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Camera, CloudRain, Download, History, LineChart, MapPin, Plus, Syringe, Trash2, ChevronRight } from 'lucide-react'
import { plotObservations, useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Badge, CategoryBadge, SeverityPill, TrendIndicator } from '@/components/ui/Badges'
import { Tabs } from '@/components/ui/Tabs'
import { KeyValue } from '@/components/ui/Misc'
import { ForecastChart } from '@/components/charts/ForecastChart'
import { WeatherCharts } from '@/components/charts/WeatherCharts'
import { HorizonCards } from '@/components/domain/HorizonCards'
import { WeatherFeatureTable } from '@/components/domain/WeatherFeatureTable'
import { LeafIllustration } from '@/components/domain/LeafIllustration'
import { DISEASES } from '@/lib/constants'
import { downloadFile, formatDate, formatDateTime, hashString, isoDate, uid } from '@/lib/utils'
import type { TreatmentEvent, TreatmentType } from '@/types'
import NotFound from './NotFound'

type TabKey = 'overview' | 'observations' | 'treatments' | 'weather'

const TREATMENT_LABEL: Record<TreatmentType, string> = {
  fungicide: 'Fungicide (expert-confirmed)',
  sanitation: 'Sanitation / frond removal',
  fertilizer: 'Fertilizer application',
  drainage: 'Drainage improvement',
  shade_management: 'Shade management',
}

export default function PlotDetail() {
  const { id } = useParams()
  const plot = useAppStore((s) => s.plots.find((p) => p.id === id))
  const observations = useAppStore((s) => s.observations)
  const treatments = useAppStore((s) => s.treatments)
  const settings = useAppStore((s) => s.settings)
  const [tab, setTab] = useState<TabKey>('overview')

  if (!plot) return <NotFound />
  const hist = plotObservations(observations, plot.id)
  const latest = hist[hist.length - 1]
  const plotTreatments = treatments.filter((t) => t.plotId === plot.id).sort((a, b) => b.date.localeCompare(a.date))

  const exportJson = () => {
    // Images are omitted from the export to keep the record small
    const record = { plot, observations: hist.map((o) => ({ ...o, imageThumb: undefined, heatmapThumb: undefined })), treatments: plotTreatments }
    downloadFile(`${plot.id}-record.json`, JSON.stringify(record, null, 2))
  }
  const exportCsv = () => {
    const header = 'observation_id,timestamp,severity,disease_class,t3,t7,t14,progression_risk,category,model_version'
    const rows = hist.map((o) =>
      [o.id, o.timestamp, o.analysis.severity, o.analysis.diseaseClass, ...o.forecast.horizons.map((h) => h.mean), o.forecast.progressionRisk, o.decision.category, o.modelVersion].join(','),
    )
    downloadFile(`${plot.id}-history.csv`, [header, ...rows].join('\n'), 'text/csv')
  }

  return (
    <>
      <PageHeader
        back={
          <ButtonLink to="/plots" variant="ghost" size="sm" className="mb-2 -ml-2" icon={<ArrowLeft className="size-4" />}>
            Plots
          </ButtonLink>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {plot.name}
            {latest && <CategoryBadge category={latest.decision.category} />}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{plot.id}</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {plot.district} · {plot.zone} zone · {plot.latitude.toFixed(3)}, {plot.longitude.toFixed(3)}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv} icon={<Download className="size-4" />}>
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportJson} icon={<Download className="size-4" />}>
              JSON
            </Button>
            <ButtonLink to={`/assess?plot=${plot.id}`} size="sm" icon={<Camera className="size-4" />}>
              New assessment
            </ButtonLink>
          </>
        }
      />

      <Tabs<TabKey>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Overview', icon: <LineChart className="size-4" /> },
          { key: 'observations', label: 'Observations', icon: <History className="size-4" />, count: hist.length },
          { key: 'treatments', label: 'Treatments', icon: <Syringe className="size-4" />, count: plotTreatments.length },
          { key: 'weather', label: 'Weather', icon: <CloudRain className="size-4" /> },
        ]}
      />

      {!latest && tab !== 'treatments' ? (
        <EmptyState
          icon={<Camera className="size-6" />}
          title="No observations yet"
          description="Capture a leaf image to estimate current severity and generate the first forecast."
          action={<ButtonLink to={`/assess?plot=${plot.id}`}>Start assessment</ButtonLink>}
        />
      ) : (
        <>
          {tab === 'overview' && latest && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader
                  title="Severity history and forecast"
                  subtitle={`Latest forecast from ${formatDateTime(latest.timestamp)}`}
                  action={
                    <Link to={`/observations/${latest.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                      Full assessment →
                    </Link>
                  }
                />
                <CardBody>
                  <ForecastChart history={hist} threshold={latest.decision.threshold} />
                  <div className="mt-4">
                    <HorizonCards observation={latest} confidenceThreshold={settings.confidenceThreshold} />
                  </div>
                </CardBody>
              </Card>
              <div className="space-y-6">
                <Card>
                  <CardHeader title="Current status" />
                  <CardBody className="divide-y divide-stone-100 py-2">
                    <KeyValue label="Disease" value={DISEASES[latest.analysis.diseaseClass].label} />
                    <KeyValue label="Current severity" value={<SeverityPill value={latest.analysis.severity} />} />
                    <KeyValue label="Trend (7 d)" value={<TrendIndicator direction={latest.forecast.direction} />} />
                    <KeyValue label="Progression risk" value={`${Math.round(latest.forecast.progressionRisk * 100)} %`} />
                    <KeyValue label="Weather pressure" value={latest.forecast.weatherPressure.toFixed(2)} />
                    <KeyValue label="Window" value={<CategoryBadge category={latest.decision.category} short />} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Plot context" />
                  <CardBody className="divide-y divide-stone-100 py-2">
                    <KeyValue label="Owner" value={plot.owner} />
                    <KeyValue label="Palms" value={plot.palmCount} />
                    <KeyValue label="Palm age" value={plot.palmAgeBand ?? '—'} />
                    <KeyValue label="Shade" value={plot.shade ?? '—'} />
                    <KeyValue label="Drainage" value={plot.drainage ?? '—'} />
                    <KeyValue label="Registered" value={formatDate(plot.createdAt)} />
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {tab === 'observations' && (
            <Card>
              <ul className="divide-y divide-stone-100">
                {[...hist].reverse().map((o) => (
                  <li key={o.id}>
                    <Link to={`/observations/${o.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50 sm:px-5">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-stone-200">
                        {o.imageThumb ? (
                          <img src={o.imageThumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <LeafIllustration severity={o.analysis.severity} seed={hashString(o.id)} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900">
                          {formatDateTime(o.timestamp)} <span className="text-xs font-normal text-stone-500">· step {o.stepIndex + 1}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          {DISEASES[o.analysis.diseaseClass].label}
                          <SeverityPill value={o.analysis.severity} />
                          <span>→ t+7 {o.forecast.horizons[1].mean.toFixed(1)}</span>
                          {o.syncStatus === 'queued' && <Badge tone="amber">Queued</Badge>}
                        </p>
                      </div>
                      <CategoryBadge category={o.decision.category} short className="hidden sm:inline-flex" />
                      <ChevronRight className="size-4 text-stone-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {tab === 'weather' && latest && (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Weather around the latest observation" subtitle="14 days observed + 14 days forecast" />
                <CardBody>
                  <WeatherCharts weather={latest.weather} />
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <WeatherFeatureTable weather={latest.weather} />
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}

      {tab === 'treatments' && <TreatmentsTab plotId={plot.id} items={plotTreatments} />}
    </>
  )
}

function TreatmentsTab({ plotId, items }: { plotId: string; items: TreatmentEvent[] }) {
  const addTreatment = useAppStore((s) => s.addTreatment)
  const removeTreatment = useAppStore((s) => s.removeTreatment)
  const [form, setForm] = useState({ date: isoDate(new Date()), type: 'sanitation' as TreatmentType, product: '', dose: '', notes: '' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    addTreatment({ id: uid('TRT'), plotId, ...form, product: form.product || undefined, dose: form.dose || undefined, notes: form.notes || undefined })
    setForm((f) => ({ ...f, product: '', dose: '', notes: '' }))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Treatment and management log" subtitle="Recorded events are used as confounder control so recovery after treatment is not mistaken for forecasting skill." />
        {items.length === 0 ? (
          <CardBody>
            <p className="py-6 text-center text-sm text-stone-500">No treatments recorded.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <Syringe className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">{TREATMENT_LABEL[t.type]}</p>
                  <p className="text-xs text-stone-500">
                    {formatDate(t.date)}
                    {t.product && ` · ${t.product}`}
                    {t.dose && ` · ${t.dose}`}
                  </p>
                  {t.notes && <p className="mt-1 text-xs text-stone-600">{t.notes}</p>}
                </div>
                <button onClick={() => removeTreatment(t.id)} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete treatment">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Record treatment" subtitle="FR-06" />
        <CardBody>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TreatmentType })}>
                {Object.entries(TREATMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} max={isoDate(new Date())} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Product</label>
                <input className="input" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
              </div>
              <div>
                <label className="label">Dose</label>
                <input className="input" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {form.type === 'fungicide' && (
              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">Only record fungicide applications confirmed by an extension officer.</p>
            )}
            <Button type="submit" className="w-full" icon={<Plus className="size-4" />}>
              Add to log
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
