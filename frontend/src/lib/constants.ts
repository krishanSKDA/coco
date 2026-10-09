import type { AgroZone, DiseaseClass, InterventionCategory } from '@/types'

export const MODEL_VERSION = 'cocofarm-c04-proto-0.1.0'
export const CORPUS_VERSION = 'corpus-v0 (demo)'

/** Table 3 – Disease Severity Scale Used for Annotation. */
export const SEVERITY_SCALE = [
  { score: 0, label: 'Healthy', criteria: 'No spots or necrosis; uniform green colour', area: '0 %', color: '#16a34a' },
  { score: 1, label: 'Trace', criteria: 'Isolated small spots with grey centres and brown margins; no coalescence', area: 'Up to 5 %', color: '#84cc16' },
  { score: 2, label: 'Mild', criteria: 'Numerous discrete spots; beginning of coalescence at leaflet margins', area: '5–20 %', color: '#eab308' },
  { score: 3, label: 'Moderate', criteria: 'Coalesced irregular necrotic patches; distinct blighted appearance on part of the frond', area: '20–50 %', color: '#f97316' },
  { score: 4, label: 'Severe', criteria: 'Extensive necrosis, drying of leaflets, frond largely non-functional', area: 'Above 50 %', color: '#dc2626' },
] as const

export const severityColor = (s: number) => SEVERITY_SCALE[Math.max(0, Math.min(4, Math.round(s)))].color
export const severityLabel = (s: number) => SEVERITY_SCALE[Math.max(0, Math.min(4, Math.round(s)))].label

export const DISEASES: Record<DiseaseClass, { label: string; pathogen: string; description: string }> = {
  healthy: { label: 'Healthy', pathogen: '—', description: 'No foliar disease symptoms detected.' },
  grey_leaf_spot: {
    label: 'Grey leaf spot',
    pathogen: 'Pestalotiopsis palmarum',
    description: 'Large grey centres with thin dark borders on older leaves.',
  },
  brown_leaf_spot: {
    label: 'Brown leaf spot',
    pathogen: 'Pestalotiopsis / related fungi',
    description: 'Small grey centres with wide brown borders.',
  },
  leaf_blight: {
    label: 'Leaf blight',
    pathogen: 'Pestalotiopsis palmarum',
    description: 'Coalescing necrotic patches drying the leaflets; blighted outer whorl.',
  },
}

/** Table 7 – Intervention-Window Definition. */
export const INTERVENTION: Record<
  InterventionCategory,
  { label: string; short: string; trigger: string; action: string; tone: 'green' | 'amber' | 'red' }
> = {
  monitor: {
    label: 'Monitor and reassess',
    short: 'Monitor',
    trigger: 'Forecast severity remains below the action threshold at all three horizons, with low progression risk.',
    action: 'Continue the normal monitoring cycle; reassess at the next scheduled observation.',
    tone: 'green',
  },
  prepare: {
    label: 'Prepare for intervention',
    short: 'Prepare',
    trigger:
      'Forecast severity crosses the action threshold at the 7- or 14-day horizon, or progression risk is elevated but uncertainty is high.',
    action: 'Plan labour and inputs, increase monitoring frequency, apply cultural measures.',
    tone: 'amber',
  },
  intervene: {
    label: 'Seek expert-confirmed intervention promptly',
    short: 'Intervene',
    trigger:
      'Forecast severity crosses the action threshold at the 3-day horizon with high confidence, or current severity is already at the threshold and rising.',
    action: 'Contact the extension officer for confirmation before any chemical intervention.',
    tone: 'red',
  },
}

export const CATEGORY_RANK: Record<InterventionCategory, number> = { monitor: 0, prepare: 1, intervene: 2 }

/** Representative Sri Lankan coconut-growing districts and coordinates. */
export const DISTRICTS: { name: string; lat: number; lon: number; zone: AgroZone }[] = [
  { name: 'Kurunegala', lat: 7.4863, lon: 80.3647, zone: 'intermediate' },
  { name: 'Puttalam', lat: 8.0362, lon: 79.8283, zone: 'dry' },
  { name: 'Gampaha', lat: 7.0873, lon: 80.0144, zone: 'wet' },
  { name: 'Colombo', lat: 6.9271, lon: 79.8612, zone: 'wet' },
  { name: 'Kalutara', lat: 6.5854, lon: 79.9607, zone: 'wet' },
  { name: 'Galle', lat: 6.0535, lon: 80.221, zone: 'wet' },
  { name: 'Matara', lat: 5.9549, lon: 80.555, zone: 'wet' },
  { name: 'Hambantota', lat: 6.1241, lon: 81.1185, zone: 'dry' },
  { name: 'Kegalle', lat: 7.2513, lon: 80.3464, zone: 'wet' },
  { name: 'Anuradhapura', lat: 8.3114, lon: 80.4037, zone: 'dry' },
  { name: 'Batticaloa', lat: 7.731, lon: 81.6747, zone: 'dry' },
  { name: 'Jaffna', lat: 9.6615, lon: 80.0255, zone: 'dry' },
]

export const HORIZONS = [3, 7, 14] as const
