import type { KnowledgeEntry } from '@/types'

/**
 * FR-14 / NFR-06 – management guidance is drawn ONLY from this curated
 * knowledge base; the system never generates free-form chemical
 * prescriptions. Prototype entries summarise integrated disease management
 * principles from [4], [6], [7] and are flagged for expert review.
 */
export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'KB-MON-001',
    title: 'Routine monitoring cycle',
    category: 'monitor',
    diseases: 'all',
    type: 'monitoring',
    summary: 'Keep a regular observation rhythm so the plot history stays complete and forecasts stay calibrated.',
    steps: [
      'Photograph the same marked palms at each visit, focusing on the older (outer whorl) fronds.',
      'Reassess at the next scheduled observation (typically 7 days).',
      'Record any management activity in the treatment log the same day.',
    ],
    source: 'Integrated disease management guidance [4], [7]',
    reviewStatus: 'approved',
  },
  {
    id: 'KB-CUL-002',
    title: 'Field sanitation',
    category: 'prepare',
    diseases: ['grey_leaf_spot', 'brown_leaf_spot', 'leaf_blight'],
    type: 'cultural',
    summary: 'Reduce inoculum by removing badly affected fronds; the pathogen spreads by wind and rain splash.',
    steps: [
      'Remove severely affected outer fronds and leaflets.',
      'Destroy removed material away from the plantation – do not leave it on the ground.',
      'Clean tools between palms where practical.',
    ],
    source: 'CRI grower advisory on leaf blight [6]; Pacific Pests fact sheet [4]',
    reviewStatus: 'approved',
  },
  {
    id: 'KB-NUT-003',
    title: 'Balanced nutrition',
    category: 'prepare',
    diseases: 'all',
    type: 'nutrition',
    summary: 'Leaf spot and blight are most damaging on nutritionally poor palms; restore balanced fertilization.',
    steps: [
      'Apply the recommended adult palm fertilizer mixture according to the CRI schedule for your zone.',
      'Ask the extension officer about soil testing if symptoms recur across seasons.',
    ],
    source: 'Pacific Pests fact sheet [4]; CRI recommendations [1]',
    reviewStatus: 'pending-review',
  },
  {
    id: 'KB-CUL-004',
    title: 'Drainage and shade management',
    category: 'prepare',
    diseases: 'all',
    type: 'cultural',
    summary: 'Prolonged leaf wetness favours infection. Improve air movement and drainage to shorten wet periods.',
    steps: [
      'Clear blocked drains and avoid water-logging around the palm basin.',
      'Reduce heavy shade from intercrops or weeds around affected palms.',
    ],
    source: 'Integrated disease management review [7]',
    reviewStatus: 'pending-review',
  },
  {
    id: 'KB-MON-005',
    title: 'Increase monitoring frequency',
    category: 'prepare',
    diseases: 'all',
    type: 'monitoring',
    summary: 'When the forecast approaches the action threshold, shorten the observation interval.',
    steps: [
      'Move from weekly to every 3–4 days until the forecast falls back below the threshold.',
      'Plan labour and inputs now so action is possible inside the forecast window.',
    ],
    source: 'CocoFarm AI intervention-window protocol (Table 7)',
    reviewStatus: 'approved',
  },
  {
    id: 'KB-ESC-006',
    title: 'Escalate to extension officer',
    category: 'intervene',
    diseases: 'all',
    type: 'escalation',
    summary: 'Contact the Coconut Development Officer / extension officer to confirm the diagnosis and decide on action.',
    steps: [
      'Share this assessment (forecast, explanation and images) with the extension officer.',
      'Continue sanitation and cultural measures while awaiting confirmation.',
      'Do not apply any chemical without expert confirmation.',
    ],
    source: 'CocoFarm AI safety constraint (NFR-06)',
    reviewStatus: 'approved',
  },
  {
    id: 'KB-CHM-007',
    title: 'Chemical control – expert-confirmed only',
    category: 'intervene',
    diseases: ['grey_leaf_spot', 'brown_leaf_spot', 'leaf_blight'],
    type: 'chemical',
    summary: 'Fungicide is applied only when warranted and only on the recommendation of an extension officer or plant pathologist.',
    steps: [
      'Product, dose and timing must come from the officer and current CRI recommendations – the app does not prescribe them.',
      'Record the application (type, date, dose) in the treatment log so the next forecast accounts for it.',
    ],
    source: 'CRI plant protection guidance [1], [6]',
    reviewStatus: 'pending-review',
  },
]

export function guidanceFor(category: KnowledgeEntry['category'], disease: string) {
  const rank = { monitor: 0, prepare: 1, intervene: 2, all: -1 }
  return KNOWLEDGE_BASE.filter((k) => {
    const diseaseOk = k.diseases === 'all' || (k.diseases as string[]).includes(disease)
    if (!diseaseOk) return false
    if (category === 'monitor') return k.category === 'monitor'
    // escalate: include lower-tier non-monitoring guidance too
    return k.category === category || (k.category !== 'monitor' && rank[k.category] < rank[category as keyof typeof rank])
  })
}
