import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { Observation } from '@/types'
import { hashString } from '@/lib/utils'
import { LeafIllustration } from './LeafIllustration'

export function GradCamViewer({ observation }: { observation: Observation }) {
  const [show, setShow] = useState(true)
  const [opacity, setOpacity] = useState(0.65)
  const hasPhoto = Boolean(observation.imageThumb)

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-stone-200">
        {hasPhoto ? (
          <>
            <img src={observation.imageThumb} alt="Submitted leaf" className="absolute inset-0 h-full w-full object-cover" />
            {observation.heatmapThumb && (
              <img
                src={observation.heatmapThumb}
                alt="Grad-CAM overlay"
                className="absolute inset-0 h-full w-full object-cover transition-opacity"
                style={{ opacity: show ? opacity : 0 }}
              />
            )}
          </>
        ) : (
          <LeafIllustration severity={observation.analysis.severity} seed={hashString(observation.id)} heatmap={show} opacity={opacity} />
        )}
        {show && (
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white">
            <span>low</span>
            <span className="h-1.5 w-16 rounded-full" style={{ background: 'linear-gradient(90deg,#2563eb,#22d3ee,#facc15,#ef4444)' }} />
            <span>high influence</span>
          </div>
        )}
        {!hasPhoto && (
          <span className="absolute top-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">Illustration (demo record)</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => setShow((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {show ? 'Hide' : 'Show'} Grad-CAM
        </button>
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.05}
          value={opacity}
          disabled={!show}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="flex-1 accent-brand-700"
          aria-label="Overlay opacity"
        />
      </div>
    </div>
  )
}
