import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Crosshair, Save } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Misc'
import { DISTRICTS } from '@/lib/constants'
import type { AgroZone, Plot } from '@/types'

export default function PlotNew() {
  const navigate = useNavigate()
  const plots = useAppStore((s) => s.plots)
  const addPlot = useAppStore((s) => s.addPlot)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    owner: '',
    district: 'Kurunegala',
    zone: 'intermediate' as AgroZone,
    latitude: String(DISTRICTS[0].lat),
    longitude: String(DISTRICTS[0].lon),
    palmCount: '100',
    palmAgeBand: '' as Plot['palmAgeBand'] | '',
    shade: '' as Plot['shade'] | '',
    drainage: '' as Plot['drainage'] | '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const onDistrict = (name: string) => {
    const d = DISTRICTS.find((x) => x.name === name)!
    setForm((f) => ({ ...f, district: name, zone: d.zone, latitude: String(d.lat), longitude: String(d.lon) }))
  }

  const useGps = () => {
    if (!('geolocation' in navigator)) return setGeoMsg('Geolocation is not available on this device.')
    setGeoMsg('Locating…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(5))
        set('longitude', pos.coords.longitude.toFixed(5))
        setGeoMsg(`Location captured (±${Math.round(pos.coords.accuracy)} m).`)
      },
      (err) => setGeoMsg(`Could not get location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const nextId = () => {
    const prefix = form.district.slice(0, 3).toUpperCase()
    const n = plots.length + 1
    return `PLT-${prefix}-${String(n).padStart(4, '0')}`
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const plot: Plot = {
      id: nextId(),
      name: form.name.trim(),
      owner: form.owner.trim() || '—',
      district: form.district,
      zone: form.zone,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      palmCount: Number(form.palmCount) || 0,
      palmAgeBand: form.palmAgeBand || undefined,
      shade: form.shade || undefined,
      drainage: form.drainage || undefined,
      createdAt: new Date().toISOString(),
    }
    addPlot(plot)
    navigate(`/plots/${plot.id}`)
  }

  const latOk = Number(form.latitude) >= 5.8 && Number(form.latitude) <= 9.9
  const lonOk = Number(form.longitude) >= 79.5 && Number(form.longitude) <= 82
  const valid = form.name.trim().length > 1 && latOk && lonOk

  return (
    <>
      <PageHeader
        back={
          <ButtonLink to="/plots" variant="ghost" size="sm" className="mb-2 -ml-2" icon={<ArrowLeft className="size-4" />}>
            Plots
          </ButtonLink>
        }
        title="Register a plot"
        subtitle="The plot receives a persistent identifier. Location and identity become immutable once observations are synchronised (NFR-07)."
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Plot identity" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">
                  Plot name *
                </label>
                <input id="name" className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Home garden – north block" />
              </div>
              <div>
                <label className="label" htmlFor="owner">
                  Grower / owner
                </label>
                <input id="owner" className="input" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="palms">
                  Number of palms
                </label>
                <input id="palms" type="number" min={1} className="input" value={form.palmCount} onChange={(e) => set('palmCount', e.target.value)} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Location" subtitle="Used to retrieve the plot's weather window (NASA POWER / forecast)." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="district">
                  District
                </label>
                <select id="district" className="input" value={form.district} onChange={(e) => onDistrict(e.target.value)}>
                  {DISTRICTS.map((d) => (
                    <option key={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="zone">
                  Agro-climatic zone
                </label>
                <select id="zone" className="input" value={form.zone} onChange={(e) => set('zone', e.target.value as AgroZone)}>
                  <option value="wet">Wet zone</option>
                  <option value="intermediate">Intermediate zone</option>
                  <option value="dry">Dry zone</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="lat">
                  Latitude
                </label>
                <input id="lat" className="input" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
                {!latOk && <p className="mt-1 text-xs text-red-600">Must be within Sri Lanka (5.8 – 9.9)</p>}
              </div>
              <div>
                <label className="label" htmlFor="lon">
                  Longitude
                </label>
                <input id="lon" className="input" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
                {!lonOk && <p className="mt-1 text-xs text-red-600">Must be within Sri Lanka (79.5 – 82.0)</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="button" variant="secondary" size="sm" onClick={useGps} icon={<Crosshair className="size-4" />}>
                  Use device GPS
                </Button>
                {geoMsg && <span className="text-xs text-stone-500">{geoMsg}</span>}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Crop context" subtitle="Optional – the model runs without it." />
            <CardBody className="space-y-4">
              <div>
                <label className="label">Palm age band</label>
                <select className="input" value={form.palmAgeBand} onChange={(e) => set('palmAgeBand', e.target.value as Plot['palmAgeBand'])}>
                  <option value="">Not specified</option>
                  <option value="young">Young (&lt; 10 years)</option>
                  <option value="mature">Mature (10–40 years)</option>
                  <option value="old">Old (&gt; 40 years)</option>
                </select>
              </div>
              <div>
                <label className="label">Shade</label>
                <select className="input" value={form.shade} onChange={(e) => set('shade', e.target.value as Plot['shade'])}>
                  <option value="">Not specified</option>
                  <option value="none">None</option>
                  <option value="partial">Partial</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>
              <div>
                <label className="label">Drainage</label>
                <select className="input" value={form.drainage} onChange={(e) => set('drainage', e.target.value as Plot['drainage'])}>
                  <option value="">Not specified</option>
                  <option value="good">Good</option>
                  <option value="moderate">Moderate</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </CardBody>
          </Card>
          <Callout title={`Identifier: ${nextId()}`}>Assigned on save. All future observations of this plot will reference it.</Callout>
          <Button type="submit" size="lg" className="w-full" disabled={!valid} icon={<Save className="size-4" />}>
            Register plot
          </Button>
        </div>
      </form>
    </>
  )
}
