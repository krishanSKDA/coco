import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AlertItem, Observation, Plot, Settings, TreatmentEvent } from '@/types'
import { maybeAlert } from '@/lib/pipeline'
import { uploadObservation } from '@/services/apiClient'

const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  role: 'officer',
  actionThreshold: 3,
  confidenceThreshold: 0.6,
  liveWeather: true,
}

interface AppState {
  plots: Plot[]
  observations: Observation[]
  treatments: TreatmentEvent[]
  alerts: AlertItem[]
  settings: Settings

  addPlot: (p: Plot) => void
  addObservation: (o: Observation) => void
  addTreatment: (t: TreatmentEvent) => void
  removeTreatment: (id: string) => void
  markAlertRead: (id: string) => void
  markAllAlertsRead: () => void
  updateSettings: (s: Partial<Settings>) => void
  /** Upload queued observations to the server; resolves to how many were stored. */
  syncQueued: () => Promise<number>
  /** Remove plots, observations, treatments and alerts from this device. */
  clearLocalData: () => void
}

type Records = Pick<AppState, 'plots' | 'observations' | 'treatments' | 'alerts'>

const EMPTY: Records = { plots: [], observations: [], treatments: [], alerts: [] }

/** Plots of the demo data shipped before v2; removed with everything attached to them. */
const DEMO_PLOT_IDS = new Set(['PLT-GAM-0002', 'PLT-KUR-0001', 'PLT-PUT-0005', 'PLT-MAT-0004', 'PLT-PUT-0003', 'PLT-HAM-0006'])

function withoutDemoData(s: Records): Records {
  const keep = <T extends { plotId: string }>(xs: T[] = []) => xs.filter((x) => !DEMO_PLOT_IDS.has(x.plotId))
  return {
    plots: (s.plots ?? []).filter((p) => !DEMO_PLOT_IDS.has(p.id)),
    observations: keep(s.observations),
    treatments: keep(s.treatments),
    alerts: keep(s.alerts),
  }
}

/**
 * Safe localStorage wrapper – a full quota (large image thumbnails) must not
 * crash the app; observations still live in memory for the session.
 */
const safeStorage = createJSONStorage(() => ({
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch (e) {
      console.warn('[CocoFarm] Could not persist state (storage quota?)', e)
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}))

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      settings: DEFAULT_SETTINGS,

      addPlot: (p) => set((s) => ({ plots: [...s.plots, p] })),

      addObservation: (o) =>
        set((s) => {
          const plot = s.plots.find((p) => p.id === o.plotId)
          const prev = s.observations
            .filter((x) => x.plotId === o.plotId)
            .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0]
          const alert = plot ? maybeAlert(plot, o, prev?.decision.category ?? null) : null
          return {
            observations: [...s.observations, o],
            alerts: alert ? [alert, ...s.alerts] : s.alerts,
          }
        }),

      addTreatment: (t) => set((s) => ({ treatments: [...s.treatments, t] })),
      removeTreatment: (id) => set((s) => ({ treatments: s.treatments.filter((t) => t.id !== id) })),

      markAlertRead: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)) })),
      markAllAlertsRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      syncQueued: async () => {
        const queued = get().observations.filter((o) => o.syncStatus === 'queued')
        const results = await Promise.allSettled(queued.map(uploadObservation))
        const done = new Set(queued.filter((_, i) => results[i].status === 'fulfilled').map((o) => o.id))
        if (done.size) set((s) => ({ observations: s.observations.map((o) => (done.has(o.id) ? { ...o, syncStatus: 'synced' as const } : o)) }))
        return done.size
      },

      clearLocalData: () => set(EMPTY),
    }),
    {
      name: 'cocofarm-c04',
      version: 2,
      storage: safeStorage,
      migrate: (persisted, version) => {
        const s = persisted as AppState
        return (version < 2 ? { ...s, ...withoutDemoData(s) } : s) as AppState
      },
    },
  ),
)

// ---- Selectors -----------------------------------------------------------

export const sortByTime = (a: Observation, b: Observation) => +new Date(a.timestamp) - +new Date(b.timestamp)

export function plotObservations(observations: Observation[], plotId: string) {
  return observations.filter((o) => o.plotId === plotId).sort(sortByTime)
}

export function latestObservation(observations: Observation[], plotId: string) {
  const list = plotObservations(observations, plotId)
  return list[list.length - 1]
}
