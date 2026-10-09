import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Camera, CheckCircle2, CircleAlert, Crosshair, ImagePlus, Loader2, Upload, WifiOff, XCircle, Play, RotateCcw } from 'lucide-react'
import { plotObservations, useAppStore } from '@/store/useAppStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Callout, PrototypeTag } from '@/components/ui/Misc'
import { SeverityPill } from '@/components/ui/Badges'
import { analyzeImage, fileToDataUrl, type ImagePipelineResult } from '@/lib/imageAnalysis'
import { warmUpLesionModel } from '@/lib/lesionModel'
import { runAssessment, STAGES, type StageKey } from '@/services/assessmentService'
import { DISEASES } from '@/lib/constants'
import { cn } from '@/lib/utils'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function Assess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const online = useOnlineStatus()
  const plots = useAppStore((s) => s.plots)
  const observations = useAppStore((s) => s.observations)
  const treatments = useAppStore((s) => s.treatments)
  const settings = useAppStore((s) => s.settings)
  const addObservation = useAppStore((s) => s.addObservation)

  const [plotId, setPlotId] = useState(params.get('plot') ?? plots[0]?.id ?? '')
  const [preview, setPreview] = useState<string | null>(null)
  const [image, setImage] = useState<ImagePipelineResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState(nowLocal)
  const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [override, setOverride] = useState(false)
  const [stage, setStage] = useState<StageKey | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const plot = plots.find((p) => p.id === plotId)

  // Load the lesion model while the user frames the photo; analyzeImage falls back if it fails
  useEffect(() => {
    warmUpLesionModel().catch(() => {})
  }, [])

  const processSource = async (src: string) => {
    setPreview(src)
    setImage(null)
    setError(null)
    setOverride(false)
    setAnalyzing(true)
    try {
      setImage(await analyzeImage(src))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Please choose an image file.')
    processSource(await fileToDataUrl(f))
  }

  const captureGps = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => setError('Could not read device location – the plot location will be used.'),
    )

  const canRun = plot && image && (image.quality.passed || override) && !stage

  const run = async () => {
    if (!plot || !image) return
    try {
      const obs = await runAssessment(
        {
          plot,
          image,
          timestamp: new Date(timestamp).toISOString(),
          latitude: gps?.lat ?? plot.latitude,
          longitude: gps?.lon ?? plot.longitude,
          notes: notes || undefined,
          previous: plotObservations(observations, plot.id),
          treatments,
          settings,
          online,
        },
        setStage,
      )
      addObservation(obs)
      navigate(`/observations/${obs.id}`)
    } catch (e) {
      setStage(null)
      setError(e instanceof Error ? e.message : 'Assessment failed')
    }
  }

  const stageIdx = stage ? STAGES.findIndex((s) => s.key === stage) : -1

  return (
    <>
      <PageHeader title="New assessment" subtitle="Capture a leaf image for a registered plot. The system estimates current severity, forecasts 3-, 7- and 14-day severity and assigns an intervention window." />

      {!online && (
        <Callout tone="warn" icon={<WifiOff className="size-4" />} title="You are offline" className="mb-4">
          The assessment runs on this device with simulated weather and is queued for synchronisation when connectivity returns.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="1 · Plot" />
            <CardBody>
              {plots.length === 0 && (
                <Callout tone="warn" title="No plots registered yet" className="mb-3">
                  Assessments are recorded against a plot.{' '}
                  <Link to="/plots/new" className="font-medium underline">
                    Register a plot
                  </Link>{' '}
                  first.
                </Callout>
              )}
              <select className="input" value={plotId} onChange={(e) => setPlotId(e.target.value)} disabled={plots.length === 0}>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.id}
                  </option>
                ))}
              </select>
              {plot && (
                <p className="mt-2 text-xs text-stone-500">
                  {plot.district} · {plot.zone} zone · {plotObservations(observations, plot.id).length} previous observations
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="2 · Leaf image" subtitle="Photograph a mature (outer whorl) frond so the leaflets fill most of the frame." />
            <CardBody>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

              {preview ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-stone-100">
                  <img src={preview} alt="Selected leaf" className="h-full w-full object-cover" />
                  {analyzing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
                      <Loader2 className="mr-2 size-5 animate-spin" /> Checking image quality…
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setPreview(null)
                      setImage(null)
                    }}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/75"
                  >
                    <RotateCcw className="size-3.5" /> Retake
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    onFile(e.dataTransfer.files?.[0])
                  }}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center"
                >
                  <ImagePlus className="size-10 text-stone-400" />
                  <p className="mt-2 text-sm font-medium text-stone-700">Drop a leaf photo here</p>
                  <p className="text-xs text-stone-500">JPG or PNG from camera or gallery</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" size="sm" icon={<Camera className="size-4" />} onClick={() => camRef.current?.click()}>
                      Take photo
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                      Upload
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="3 · Observation details" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Timestamp</label>
                <input type="datetime-local" className="input" value={timestamp} max={nowLocal()} onChange={(e) => setTimestamp(e.target.value)} />
              </div>
              <div>
                <label className="label">Location</label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    readOnly
                    value={gps ? `${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)} (GPS)` : plot ? `${plot.latitude.toFixed(4)}, ${plot.longitude.toFixed(4)} (plot)` : ''}
                  />
                  <Button type="button" variant="secondary" onClick={captureGps} aria-label="Use GPS" title="Use device GPS">
                    <Crosshair className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes (optional)</label>
                <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Symptoms mostly on lower fronds of palms 12–18" />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Image quality gate" subtitle="FR-03 · checked on-device before inference" />
            <CardBody>
              {!image ? (
                <p className="text-sm text-stone-500">{analyzing ? 'Analysing…' : 'Add an image to run the quality checks.'}</p>
              ) : (
                <div className="space-y-3">
                  <QualityRow ok={image.quality.sharpness >= 30} label="Sharpness" value={`${image.quality.sharpness}`} hint="Laplacian variance ≥ 30" />
                  <QualityRow
                    ok={image.quality.brightness >= 50 && image.quality.brightness <= 215}
                    label="Exposure"
                    value={`${image.quality.brightness}/255`}
                    hint="Mean luminance 50–215"
                  />
                  <QualityRow ok={image.quality.frondRatio >= 0.2} label="Frond present" value={`${Math.round(image.quality.frondRatio * 100)} % foliage`} hint="≥ 20 % of frame" />
                  {image.quality.issues.length > 0 && (
                    <ul className="space-y-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                      {image.quality.issues.map((i) => (
                        <li key={i}>• {i}</li>
                      ))}
                    </ul>
                  )}
                  {!image.quality.passed && (
                    <label className="flex items-start gap-2 text-xs text-stone-600">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 accent-brand-700" />
                      Proceed anyway (confidence will be reduced and the result flagged).
                    </label>
                  )}
                  <div className="border-t border-stone-100 pt-3">
                    <p className="mb-1 flex items-center gap-2 text-xs font-medium text-stone-500">
                      Preliminary reading <PrototypeTag />
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-stone-800">{DISEASES[image.analysis.diseaseClass].label}</span>
                      <SeverityPill value={image.analysis.severity} />
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {error && (
            <Callout tone="danger" icon={<CircleAlert className="size-4" />}>
              {error}
            </Callout>
          )}

          <Card>
            <CardBody>
              {stage ? (
                <ol className="space-y-2.5">
                  {STAGES.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-2.5 text-sm">
                      {i < stageIdx ? (
                        <CheckCircle2 className="size-4.5 text-brand-600" />
                      ) : i === stageIdx ? (
                        <Loader2 className="size-4.5 animate-spin text-sky-600" />
                      ) : (
                        <span className="size-4.5 rounded-full border-2 border-stone-200" />
                      )}
                      <span className={cn(i <= stageIdx ? 'text-stone-900' : 'text-stone-400')}>{s.label}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <>
                  <Button size="lg" className="w-full" disabled={!canRun} onClick={run} icon={<Play className="size-4" />}>
                    Run forecast
                  </Button>
                  <p className="mt-2 text-center text-xs text-stone-500">
                    Weather: {settings.liveWeather && online ? 'NASA POWER + Open-Meteo (falls back to simulated)' : 'simulated'}
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function QualityRow({ ok, label, value, hint }: { ok: boolean; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {ok ? <CheckCircle2 className="size-5 shrink-0 text-brand-600" /> : <XCircle className="size-5 shrink-0 text-amber-600" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-[11px] text-stone-500">{hint}</p>
      </div>
      <span className="text-sm text-stone-700 tabular-nums">{value}</span>
    </div>
  )
}
