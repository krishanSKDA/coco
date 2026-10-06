import { useMemo } from 'react'
import { mulberry32 } from '@/lib/utils'

/**
 * Vector stand-in for seeded observations that have no photograph.
 * Lesion count/size follow the severity score; `heatmap` overlays the
 * Grad-CAM style evidence on the lesions.
 */
export function LeafIllustration({ severity, seed = 1, heatmap = false, opacity = 0.6 }: { severity: number; seed?: number; heatmap?: boolean; opacity?: number }) {
  const { leaflets, spots } = useMemo(() => {
    const rand = mulberry32(seed)
    const leaflets: string[] = []
    const N = 16
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      const bx = -10 + 340 * t
      const by = 200 - 150 * t - Math.sin(t * Math.PI) * 30
      for (const side of [-1, 1]) {
        const ang = -0.55 + side * 1.05 + (rand() - 0.5) * 0.15
        const len = 110 + rand() * 30
        const wid = 9 + rand() * 3
        const ex = bx + Math.cos(ang) * len
        const ey = by + Math.sin(ang) * len
        const nx = -Math.sin(ang) * wid
        const ny = Math.cos(ang) * wid
        leaflets.push(`M${bx},${by} Q${(bx + ex) / 2 + nx},${(by + ey) / 2 + ny} ${ex},${ey} Q${(bx + ex) / 2 - nx},${(by + ey) / 2 - ny} ${bx},${by}Z`)
      }
    }
    const s = Math.round(Math.max(0, Math.min(4, severity)))
    const count = [0, 8, 26, 55, 90][s]
    const size = [0, 3, 4.5, 7, 9][s]
    const spots = Array.from({ length: count }, () => ({ x: 20 + rand() * 280, y: 20 + rand() * 200, r: size * (0.6 + rand() * 0.8), rot: rand() * 180 }))
    return { leaflets, spots }
  }, [severity, seed])

  const id = `leaf-${seed}`
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" role="img" aria-label={`Illustrated frond, severity ${severity}`}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a7bfa8" />
          <stop offset="1" stopColor="#5b6b4f" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          {leaflets.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <radialGradient id={`${id}-cam`}>
          <stop offset="0" stopColor="#ef4444" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#facc15" stopOpacity="0.7" />
          <stop offset="0.75" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="240" fill={`url(#${id}-bg)`} />
      <path d="M-10,200 Q160,120 330,50" stroke="#8a7a3a" strokeWidth="5" fill="none" />
      {leaflets.map((d, i) => (
        <path key={i} d={d} fill={i % 3 ? '#3f8f34' : '#4d9a3a'} stroke="#2a5e22" strokeWidth="0.6" />
      ))}
      <g clipPath={`url(#${id}-clip)`}>
        {spots.map((s, i) => (
          <g key={i} transform={`rotate(${s.rot} ${s.x} ${s.y})`}>
            <ellipse cx={s.x} cy={s.y} rx={s.r * 1.7} ry={s.r * 1.2} fill="#d6be46" opacity="0.55" />
            <ellipse cx={s.x} cy={s.y} rx={s.r * 1.1} ry={s.r * 0.8} fill="#6b4a24" />
            <ellipse cx={s.x} cy={s.y} rx={s.r * 0.65} ry={s.r * 0.45} fill="#9b9a93" />
          </g>
        ))}
      </g>
      {heatmap && (
        <g style={{ mixBlendMode: 'multiply' }} opacity={opacity}>
          <rect width="320" height="240" fill="#1d4ed8" opacity="0.35" />
          {spots.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 5} fill={`url(#${id}-cam)`} />
          ))}
        </g>
      )}
    </svg>
  )
}
