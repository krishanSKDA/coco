import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BookOpen, Brain, Camera, CloudRain, Code2, Gauge, ScanLine, Sparkles, BadgeCheck, Clock } from 'lucide-react'
import { plotObservations, useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Badge, SeverityPill, TrendIndicator } from '@/components/ui/Badges'
import { KeyValue, ProgressBar, PrototypeTag } from '@/components/ui/Misc'
import { ForecastChart } from '@/components/charts/ForecastChart'
import { AttributionBars } from '@/components/charts/AttributionBars'
import { ProbabilityBars } from '@/components/charts/ProbabilityBars'
import { WeatherCharts } from '@/components/charts/WeatherCharts'
import { GradCamViewer } from '@/components/domain/GradCamViewer'
import { InterventionPanel } from '@/components/domain/InterventionPanel'
import { HorizonCards } from '@/components/domain/HorizonCards'
import { WeatherFeatureTable } from '@/components/domain/WeatherFeatureTable'
import { DISEASES, SEVERITY_SCALE, severityColor } from '@/lib/constants'
import { guidanceFor } from '@/data/knowledgeBase'
import { formatDateTime } from '@/lib/utils'
import type { DiseaseClass } from '@/types'
import NotFound from './NotFound'

export default function ObservationResult() {
  const { id } = useParams()
  const obs = useAppStore((s) => s.observations.find((o) => o.id === id))
  const plot = useAppStore((s) => s.plots.find((p) => p.id === obs?.plotId))
  const observations = useAppStore((s) => s.observations)
  const confidenceThreshold = useAppStore((s) => s.settings.confidenceThreshold)
  const [showApi, setShowApi] = useState(false)

  if (!obs || !plot) return <NotFound />

  // History up to and including this observation
  const history = plotObservations(observations, plot.id).filter((o) => new Date(o.timestamp) <= new Date(obs.timestamp))
  const guidance = guidanceFor(obs.decision.category, obs.analysis.diseaseClass)
  const { analysis, forecast } = obs

  const apiResponse = {
    observation_id: obs.id,
    plot_id: obs.plotId,
    timestamp: obs.timestamp,
    model_version: obs.modelVersion,
    current: { disease_class: analysis.diseaseClass, severity: analysis.severity, confidence: analysis.confidence },
    forecast: forecast.horizons.map((h) => ({ horizon_days: h.horizon, severity: h.mean, interval_90: [h.lower, h.upper], confidence: h.confidence })),
    progression_risk: forecast.progressionRisk,
    direction: forecast.direction,
    intervention: { category: obs.decision.category, threshold: obs.decision.threshold, conservative_fallback: obs.decision.conservativeFallback, low_confidence: obs.decision.lowConfidence },
    explanation: { tabular: obs.attributions.map((a) => ({ feature: a.feature, contribution: a.contribution })), image: 'gradcam_overlay.jpg' },
    weather_source: obs.weather.source,
  }

  return (
    <>
      <PageHeader
        back={
          <ButtonLink to={`/plots/${plot.id}`} variant="ghost" size="sm" className="mb-2 -ml-2" icon={<ArrowLeft className="size-4" />}>
            {plot.name}
          </ButtonLink>
        }
        title="Assessment result"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDateTime(obs.timestamp)}
            </span>
            <span className="font-mono text-xs">{obs.id}</span>
            <span>Observation {obs.stepIndex + 1} for this plot</span>
            {obs.syncStatus === 'queued' && <Badge tone="amber">Queued for sync</Badge>}
          </span>
        }
        actions={
          <ButtonLink to={`/assess?plot=${plot.id}`} variant="secondary" size="sm" icon={<Camera className="size-4" />}>
            Reassess
          </ButtonLink>
        }
      />

      <InterventionPanel observation={obs} />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Left column – image evidence */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Leaf image & Grad-CAM" subtitle="Regions that most influenced the severity estimate" icon={<ScanLine className="size-4" />} action={<PrototypeTag />} />
            <CardBody>
              <GradCamViewer observation={obs} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Current state" subtitle="Image encoder output" icon={<Brain className="size-4" />} />
            <CardBody className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-stone-700">Disease class</p>
                  <span className="text-xs text-stone-500">{DISEASES[analysis.diseaseClass].pathogen}</span>
                </div>
                <p className="mt-0.5 text-lg font-semibold text-stone-900">{DISEASES[analysis.diseaseClass].label}</p>
                <div className="mt-2">
                  <ProbabilityBars
                    highlight={analysis.diseaseClass}
                    items={(Object.keys(analysis.classProbs) as DiseaseClass[]).map((k) => ({ key: k, label: DISEASES[k].label, value: analysis.classProbs[k] }))}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-stone-700">Severity (0–4 ordinal)</p>
                  <SeverityPill value={analysis.severity} />
                </div>
                <p className="mt-1 text-xs text-stone-500">{SEVERITY_SCALE[analysis.severity].criteria}</p>
                <div className="mt-2">
                  <ProbabilityBars
                    highlight={String(analysis.severity)}
                    colorFor={(k) => severityColor(Number(k))}
                    items={analysis.severityProbs.map((p, i) => ({ key: String(i), label: `${i} · ${SEVERITY_SCALE[i].label}`, value: p }))}
                  />
                </div>
              </div>
              <div className="divide-y divide-stone-100 border-t border-stone-100 pt-1">
                <KeyValue label="Affected frond area (est.)" value={`${Math.round(analysis.lesionFraction * 100)} %`} />
                <KeyValue label="Encoder confidence" value={`${Math.round(analysis.confidence * 100)} %`} />
                <KeyValue
                  label="Quality gate"
                  value={obs.quality.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="amber">Overridden</Badge>}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right column – forecast + explanation */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Progression forecast" subtitle="Calibrated 90 % intervals at 3, 7 and 14 days" icon={<Gauge className="size-4" />} />
            <CardBody>
              <ForecastChart history={history} threshold={obs.decision.threshold} />
              <div className="mt-4">
                <HorizonCards observation={obs} confidenceThreshold={confidenceThreshold} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-700">Progression risk</span>
                    <span className="font-semibold text-stone-900 tabular-nums">{Math.round(forecast.progressionRisk * 100)} %</span>
                  </div>
                  <ProgressBar className="mt-2" height="h-2" value={forecast.progressionRisk} color={forecast.progressionRisk > 0.6 ? '#dc2626' : forecast.progressionRisk > 0.35 ? '#d97706' : '#059669'} />
                  <p className="mt-1.5 text-[11px] text-stone-500">Probability severity rises by ≥ 0.5 units within 14 days</p>
                </div>
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-700">Direction of change</span>
                    <TrendIndicator direction={forecast.direction} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-stone-600">Weather pressure</span>
                    <span className="font-semibold text-stone-900 tabular-nums">{forecast.weatherPressure.toFixed(2)}×</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-stone-500">1.0 = neutral conditions for fungal progression</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Why this forecast?"
              subtitle="Contribution of weather, history, treatment and context to the 7-day forecast"
              icon={<Sparkles className="size-4" />}
              action={<PrototypeTag>Approx. SHAP</PrototypeTag>}
            />
            <CardBody className="space-y-5">
              {obs.attributions.length === 0 && (
                <p className="text-sm text-stone-600">
                  No driver changes the 7-day forecast meaningfully – {analysis.severity >= 4 ? 'severity is already at the top of the scale.' : 'conditions are close to neutral and the plot is stable.'}
                </p>
              )}
              <AttributionBars items={obs.attributions} />
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">In plain language</p>
                <ul className="space-y-1.5 text-sm text-stone-700">
                  {obs.attributions.slice(0, 4).map((a) => (
                    <li key={a.feature} className="flex gap-2">
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.contribution > 0 ? 'bg-red-500' : 'bg-emerald-600'}`} />
                      {a.statement}
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Weather window" subtitle="Observed 14 days and forecast 14 days for this location" icon={<CloudRain className="size-4" />} />
        <CardBody className="space-y-6">
          <WeatherCharts weather={obs.weather} />
          <WeatherFeatureTable weather={obs.weather} />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Management guidance"
          subtitle="Drawn only from the expert-reviewed knowledge base – no free-form prescriptions (FR-14)"
          icon={<BookOpen className="size-4" />}
          action={
            <Link to="/knowledge" className="text-xs font-medium text-brand-700 hover:underline">
              Knowledge base
            </Link>
          }
        />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {guidance.map((g) => (
            <div key={g.id} className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-stone-900">{g.title}</p>
                {g.reviewStatus === 'approved' ? (
                  <Badge tone="green" icon={<BadgeCheck className="size-3" />}>
                    Expert-approved
                  </Badge>
                ) : (
                  <Badge tone="neutral">Pending review</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-stone-600">{g.summary}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-stone-700">
                {g.steps.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-stone-400" />
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-stone-400">
                {g.id} · {g.source}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="mt-6">
        <button onClick={() => setShowApi((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800">
          <Code2 className="size-4" />
          {showApi ? 'Hide' : 'Show'} inference API response (FR-19)
        </button>
        {showApi && (
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-stone-900 p-4 text-xs text-stone-100">
            <span className="text-stone-400">POST /api/v1/plots/{plot.id}/observations → 201</span>
            {'\n'}
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        )}
        <p className="mt-3 text-[11px] text-stone-400">
          Model {obs.modelVersion} · Prototype inference: colour-segmentation encoder, weather-modulated logistic progression model and occlusion-based attribution
          stand in for the trained multimodal network.
        </p>
      </div>
    </>
  )
}
