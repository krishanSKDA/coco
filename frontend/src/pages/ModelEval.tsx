import { Database, FlaskConical, Layers, Target, GitBranch } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badges'
import { Callout, KeyValue } from '@/components/ui/Misc'
import { CORPUS_VERSION, INTERVENTION, MODEL_VERSION } from '@/lib/constants'
import { LESION_MODEL } from '@/lib/lesionModel'
import { WEATHER_FEATURE_META } from '@/lib/weather'

/** Table 5 – AI/ML components and evaluation targets. */
const METRICS = [
  { component: 'Disease classification', technique: 'Transfer-learned CNN (EfficientNet / MobileNetV2 / ResNet)', target: 'Accuracy ≥ 90 %, macro F1 ≥ 0.88' },
  { component: 'Current severity estimation', technique: 'Ordinal regression head', target: 'Quadratic weighted kappa ≥ 0.80' },
  { component: 'Temporal forecasting', technique: 'LSTM / GRU / TCN', target: 'MAE ≤ 0.5 at 7 days; RMSE per horizon' },
  { component: 'Multimodal fusion', technique: 'Concatenation, gated fusion or attention', target: '≥ 25 % MAE reduction vs persistence at every horizon' },
  { component: 'Progression direction', technique: 'Derived from horizon heads', target: 'Direction-of-change accuracy ≥ 0.80' },
  { component: 'Uncertainty calibration', technique: 'Temperature scaling [20]', target: 'ECE < 0.05' },
  { component: 'Image explainability', technique: 'Grad-CAM [13]', target: '≥ 75 % rated acceptable by experts' },
  { component: 'Tabular explainability', technique: 'SHAP [14]', target: 'Attribution ranking stable under perturbation' },
  { component: 'Intervention window', technique: 'Expert-defined thresholds', target: 'Accuracy ≥ 0.80, macro F1 ≥ 0.75, median lead ≥ 5 d' },
  { component: 'Deployment', technique: 'On-device inference', target: '≤ 2 s per assessment; model ≤ 60 MB' },
]

/** Table 6 – Baseline and ablation configurations. */
const ABLATIONS = [
  { name: 'Persistence baseline', inputs: 'Current severity only', isolates: 'The floor – any useful model must beat it' },
  { name: 'Image-only', inputs: 'Leaf image at time t', isolates: 'How much of the future is visible in the present image' },
  { name: 'Image + weather', inputs: 'Image + weather-window features', isolates: 'Contribution of environmental drivers' },
  { name: 'Image + history', inputs: 'Image + previous severity sequence', isolates: 'Contribution of plant-level tracking' },
  { name: 'Full multimodal (proposed)', inputs: 'Image, weather, history, context', isolates: 'Combined contribution and interactions' },
  { name: 'Classical reference', inputs: 'Gradient boosting on tabular features', isolates: 'Whether deep temporal modelling is justified' },
]

const PIPELINE = [
  { title: 'Quality filtering & de-duplication', desc: 'Perceptual hashing across the union of all public sources; sharpness/exposure/frond filters with logged discards.' },
  { title: 'Severity re-labelling', desc: 'Every image re-scored to the 0–4 rubric; 15 % double-labelled; Cohen’s κ < 0.70 triggers rubric revision.' },
  { title: 'Sequence assembly', desc: 'Images grouped into synthetic plot identifiers ordered by severity.' },
  { title: 'Weather pairing', desc: 'Each sequence gets a Sri Lankan coordinate + start date; real NASA POWER records retrieved for its span.' },
  { title: 'Trajectory generation', desc: 'Logistic / Gompertz progress model with weather-modulated rate, calibrated to coconut grey leaf spot behaviour [5].' },
]

export default function ModelEval() {
  const settings = useAppStore((s) => s.settings)
  return (
    <>
      <PageHeader title="Model & evaluation" subtitle="Research artefact view: model registry, evaluation targets, ablation design and decision thresholds." />

      <Callout className="mb-6" title="This build runs a prototype inference engine">
        The UI is wired to the same contract as the trained multimodal model. Results shown in assessments come from a weather-modulated progression model (the corpus
        generator), a colour-segmentation severity estimator and occlusion-based attribution. Experimental results will populate this page once training is complete.
      </Callout>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Model registry" icon={<GitBranch className="size-4" />} />
          <CardBody className="divide-y divide-stone-100 py-2">
            <KeyValue label="Deployed model" value={<span className="font-mono text-xs">{MODEL_VERSION}</span>} />
            <KeyValue label="Lesion segmenter" value={<span className="font-mono text-xs">{LESION_MODEL.version}</span>} />
            <KeyValue label="Segmenter test mask mAP50" value={<span title="5 test images, leaflet-level pipeline-test labels">0.72 (n = 5, pipeline test)</span>} />
            <KeyValue label="Corpus build" value={<span className="font-mono text-xs">{CORPUS_VERSION}</span>} />
            <KeyValue label="Evaluation gate" value={<Badge tone="amber">Pending training</Badge>} />
            <KeyValue label="Calibration" value="Temperature scaling" />
            <KeyValue label="Horizons" value="3 · 7 · 14 days" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Decision thresholds" subtitle="Configurable in Settings; finalised with domain experts" icon={<Target className="size-4" />} />
          <CardBody className="divide-y divide-stone-100 py-2">
            <KeyValue label="Action threshold" value={`${settings.actionThreshold.toFixed(1)} (severity)`} />
            <KeyValue label="Low-confidence below" value={`${Math.round(settings.confidenceThreshold * 100)} %`} />
            <KeyValue label="Uncertainty fallback" value="More conservative category" />
            <KeyValue label="Interval" value="90 % (±1.645σ)" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Validation design" icon={<Layers className="size-4" />} />
          <CardBody className="space-y-1.5 text-sm text-stone-700">
            <p>• Split by sequence group, source dataset and coordinate</p>
            <p>• Grouped 5-fold CV, 3 seeds, mean ± sd</p>
            <p>• Held-out weather regimes (construct validity)</p>
            <p>• Forward-chaining, source- and coordinate-held-out</p>
            <p>• Expert category agreement + SUS ≥ 70 (n ≥ 10)</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Evaluation targets (Table 5)" icon={<FlaskConical className="size-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-5 py-2 font-medium">Component</th>
                <th className="px-3 py-2 font-medium">Technique</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.component} className="border-b border-stone-100 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-stone-900">{m.component}</td>
                  <td className="px-3 py-2.5 text-stone-600">{m.technique}</td>
                  <td className="px-3 py-2.5 text-stone-800">{m.target}</td>
                  <td className="px-5 py-2.5">
                    <Badge>Not yet measured</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Baselines & ablations (Table 6)" />
          <ul className="divide-y divide-stone-100">
            {ABLATIONS.map((a) => (
              <li key={a.name} className="px-5 py-3">
                <p className="text-sm font-medium text-stone-900">{a.name}</p>
                <p className="text-xs text-stone-500">Inputs: {a.inputs}</p>
                <p className="text-xs text-stone-600">{a.isolates}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Intervention-window definition (Table 7)" />
          <ul className="divide-y divide-stone-100">
            {(Object.keys(INTERVENTION) as (keyof typeof INTERVENTION)[]).map((k) => (
              <li key={k} className="px-5 py-3">
                <p className="text-sm font-medium text-stone-900">{INTERVENTION[k].label}</p>
                <p className="mt-0.5 text-xs text-stone-600">
                  <b className="font-medium">Trigger:</b> {INTERVENTION[k].trigger}
                </p>
                <p className="text-xs text-stone-600">
                  <b className="font-medium">Action:</b> {INTERVENTION[k].action}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Forecasting corpus construction" subtitle="Five scripted, reproducible stages from public data" icon={<Database className="size-4" />} />
          <CardBody>
            <ol className="relative space-y-4 border-l border-stone-200 pl-5">
              {PIPELINE.map((p, i) => (
                <li key={p.title}>
                  <span className="absolute -left-2.5 flex size-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">{i + 1}</span>
                  <p className="text-sm font-medium text-stone-900">{p.title}</p>
                  <p className="text-xs text-stone-600">{p.desc}</p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Model inputs" subtitle="Weather-window features (Table 4) + history + context" />
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {WEATHER_FEATURE_META.map((f) => (
                <Badge key={f.key} tone="blue">
                  {f.label}
                </Badge>
              ))}
              {['Previous severity', 'Slope of change', 'Time since last change', 'Treatment events'].map((f) => (
                <Badge key={f} tone="violet">
                  {f}
                </Badge>
              ))}
              {['Palm age band', 'Shade', 'Drainage'].map((f) => (
                <Badge key={f}>{f}</Badge>
              ))}
              <Badge tone="green">Leaf image embedding</Badge>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
