import { useEffect, useState, type ReactNode } from 'react'

export type RingSegment = { key: string; value: number; color: string }

type Props = {
  segments: RingSegment[]
  size?: number
  stroke?: number
  trackColor?: string
  children?: ReactNode
  /** Texto acessível. Sem ele o anel é decorativo (aria-hidden). */
  ariaLabel?: string
  className?: string
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Fatias de um arco: comprimento (em px da circunferência) e início de cada segmento positivo,
 * com uma folga entre eles (as pontas arredondadas ocupam `stroke/2` de cada lado).
 */
export function ringSegments(values: number[], circumference: number, gap: number) {
  const total = values.reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0)
  if (total <= 0) return []
  const positive = values.filter((v) => Number.isFinite(v) && v > 0).length
  const space = positive > 1 ? gap : 0
  let start = 0
  const out: { index: number; start: number; length: number }[] = []
  values.forEach((v, index) => {
    if (!Number.isFinite(v) || v <= 0) return
    const span = (v / total) * circumference
    out.push({ index, start, length: Math.max(0.01, span - space) })
    start += span
  })
  return out
}

/** Anel em fatias (rosca): cada segmento na sua cor, com pontas arredondadas e conteúdo no centro. */
export function SegmentedRing({
  segments, size = 128, stroke = 12, trackColor = 'var(--ring-track)', children, ariaLabel, className = '',
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const arcs = ringSegments(segments.map((s) => s.value), c, stroke + 4)
  const [reduced] = useState(prefersReducedMotion)
  const [drawn, setDrawn] = useState(reduced)
  useEffect(() => {
    if (drawn) return
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [drawn])

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {arcs.map((a) => {
          const length = drawn ? a.length : 0.01
          return (
            <circle key={segments[a.index].key} data-testid="ring-segment" cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={segments[a.index].color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${length} ${c}`} strokeDashoffset={-a.start}
              style={reduced ? undefined : { transition: 'stroke-dasharray 1100ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
          )
        })}
      </svg>
      {children !== undefined && <span className="relative grid place-items-center text-center">{children}</span>}
    </span>
  )
}
