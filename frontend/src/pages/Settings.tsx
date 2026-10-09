import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Misc'
import { cn } from '@/lib/utils'
import type { Language, UserRole } from '@/types'

export default function Settings() {
  const settings = useAppStore((s) => s.settings)
  const update = useAppStore((s) => s.updateSettings)
  const clearLocalData = useAppStore((s) => s.clearLocalData)
  const [confirmReset, setConfirmReset] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences and decision parameters for this device." />
      <div className="grid max-w-4xl gap-6">
        <Card>
          <CardHeader title="Language & role" />
          <CardBody className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="label">Interface language</p>
              <Segmented<Language>
                value={settings.language}
                onChange={(language) => update({ language })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'si', label: 'සිංහල' },
                ]}
              />
            </div>
            <div>
              <p className="label">Role</p>
              <Segmented<UserRole>
                value={settings.role}
                onChange={(role) => update({ role })}
                options={[
                  { value: 'grower', label: 'Grower' },
                  { value: 'officer', label: 'Extension officer' },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Decision parameters" subtitle="Applied to new assessments. Final values are set with domain experts (Phase 5)." />
          <CardBody className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="thr">
                  Action threshold (severity units)
                </label>
                <span className="text-sm font-semibold tabular-nums">{settings.actionThreshold.toFixed(1)}</span>
              </div>
              <input
                id="thr"
                type="range"
                min={2}
                max={3.5}
                step={0.1}
                value={settings.actionThreshold}
                onChange={(e) => update({ actionThreshold: Number(e.target.value) })}
                className="w-full accent-brand-700"
              />
              <p className="text-xs text-stone-500">Default 3.0 = Moderate (coalesced necrotic patches, 20–50 % affected area).</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="conf">
                  Low-confidence threshold
                </label>
                <span className="text-sm font-semibold tabular-nums">{Math.round(settings.confidenceThreshold * 100)} %</span>
              </div>
              <input
                id="conf"
                type="range"
                min={0.4}
                max={0.85}
                step={0.05}
                value={settings.confidenceThreshold}
                onChange={(e) => update({ confidenceThreshold: Number(e.target.value) })}
                className="w-full accent-brand-700"
              />
              <p className="text-xs text-stone-500">Horizons below this confidence are flagged for expert confirmation and may trigger the conservative fallback.</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data sources" />
          <CardBody>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-brand-700" checked={settings.liveWeather} onChange={(e) => update({ liveWeather: e.target.checked })} />
              <span>
                <span className="block text-sm font-medium text-stone-800">Use live weather APIs</span>
                <span className="block text-xs text-stone-500">
                  Observed window from NASA POWER, forecast from Open-Meteo. Falls back to the deterministic simulator when offline or unavailable.
                </span>
              </span>
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data on this device" />
          <CardBody className="space-y-3">
            <p className="text-sm text-stone-600">
              Remove all plots, observations, treatments and alerts stored in this browser. Observations already synchronised to the server stay there; queued ones are lost.
            </p>
            {done && <Callout tone="success">Local data cleared.</Callout>}
            {confirmReset ? (
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    clearLocalData()
                    setConfirmReset(false)
                    setDone(true)
                  }}
                >
                  Yes, clear
                </Button>
                <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="secondary" icon={<Trash2 className="size-4" />} onClick={() => setConfirmReset(true)}>
                Clear local data
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', value === o.value ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
