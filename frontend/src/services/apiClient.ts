/**
 * Client for the CocoFarm C04 API (backend/, FastAPI + best.pt).
 *
 * In development Vite proxies /api to http://localhost:8000; set VITE_API_URL
 * to point at a deployed server instead. Every call is best-effort: the app
 * falls back to on-device inference and the offline queue (FR-16).
 */
import type { Observation } from '@/types'

const API = import.meta.env.VITE_API_URL ?? '/api/v1'
const HEALTH_TTL = 30_000

export interface ServerAnalysis {
  model: string
  engine: 'server'
  input_size: number
  lesion_fraction: number
  lesion_count: number
  lesion_conf: number
  healthy_conf: number
  lesion_mask_png: string // base64 PNG, input_size², white = lesion
  inference_ms: number
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

let health: { ok: boolean; at: number } | null = null

/** Whether the inference server is reachable; cached so offline use stays fast. */
export async function serverAvailable(): Promise<boolean> {
  if (!navigator.onLine) return false
  if (health && Date.now() - health.at < HEALTH_TTL) return health.ok
  const ok = await request<{ status: string }>('/health', {}, 2_000).then(
    (r) => r.status === 'ok',
    () => false,
  )
  health = { ok, at: Date.now() }
  return ok
}

export async function analyzeOnServer(src: string): Promise<ServerAnalysis> {
  const body = new FormData()
  body.append('image', await (await fetch(src)).blob(), 'leaf.jpg')
  return request<ServerAnalysis>('/analyze', { method: 'POST', body }, 30_000)
}

export function uploadObservation(o: Observation) {
  return request<{ id: string; receivedAt: string }>(`/plots/${encodeURIComponent(o.plotId)}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...o, syncStatus: 'synced' }),
  })
}
