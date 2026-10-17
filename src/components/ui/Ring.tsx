import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  /** Proporção 0..1. Acima de 1 o anel fica cheio e, com `overflowColor`, troca de cor. */
  value: number
  /** Diâmetro em px. */
  size?: number
  /** Espessura do traço em px. */
  stroke?: number
  /** Cor do arco (qualquer cor CSS; prefira `var(--income)` etc.). */
  color?: string
  /** Cor do arco quando `value` passa de 1 (ex.: orçamento estourado). */
  overflowColor?: string
  trackColor?: string
  /** Trilho tracejado: usado quando não há valor (dia sem gasto). */
  dashedTrack?: boolean
  /** Conteúdo centralizado dentro do anel (ícone, número). */
  children?: ReactNode
  /** Texto acessível. Sem ele o anel é decorativo (aria-hidden). */
  ariaLabel?: string
  className?: string
}

/** Proporção segura para desenhar: NaN/infinito viram 0, e tudo cabe em 0..1. */
export function ringFraction(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(1, value)
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Anel de progresso grosso com ponta arredondada, sobre trilho claro, com conteúdo no centro.
 * Ao montar, o arco se desenha (stroke-dashoffset, ease-out exponencial); respeita movimento reduzido.
 */
export function Ring({
  value, size = 64, stroke = 8, color = 'var(--primary)', overflowColor, trackColor = 'var(--ring-track)',
  dashedTrack = false, children, ariaLabel, className = '',
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fraction = ringFraction(value)
  const over = Number.isFinite(value) && value > 1
  const [reduced] = useState(prefersReducedMotion)
  const [drawn, setDrawn] = useState(reduced)
  useEffect(() => {
    if (drawn) return
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [drawn])
  const shown = drawn ? fraction : 0

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={dashedTrack ? Math.max(1.5, stroke / 4) : stroke}
          strokeDasharray={dashedTrack ? `${Math.max(2, stroke / 3)} ${Math.max(3, stroke / 2)}` : undefined} />
        {fraction > 0 && (
          <circle data-testid="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={over && overflowColor ? overflowColor : color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
            style={reduced ? undefined : { transition: 'stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1), stroke 300ms' }} />
        )}
      </svg>
      {children !== undefined && <span className="relative grid place-items-center">{children}</span>}
    </span>
  )
}
