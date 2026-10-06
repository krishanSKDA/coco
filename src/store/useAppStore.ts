import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AlertItem, Observation, Plot, Settings, TreatmentEvent } from '@/types'
import { buildSeed } from '@/lib/seed'
import { maybeAlert } from '@/lib/pipeline'

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
  syncQueued: () => number
  resetDemo: () => void
}

const seed = () => buildSeed(DEFAULT_SETTINGS)

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
      ...seed(),
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

      syncQueued: () => {
        const queued = get().observations.filter((o) => o.syncStatus === 'queued').length
        if (queued) set((s) => ({ observations: s.observations.map((o) => ({ ...o, syncStatus: 'synced' as const })) }))
        return queued
      },

      resetDemo: () => set((s) => ({ ...buildSeed(s.settings) })),
    }),
    {
      name: 'cocofarm-c04',
      version: 1,
      storage: safeStorage,
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
