import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'

/** Estilo do número enorme do destaque. O tamanho vem do HeroValue (cabe na largura, até 56px). */
export const HERO_NUMBER = 'inline-block whitespace-nowrap font-extrabold leading-[1.05] tracking-[-0.04em]'

const MAX = 56
const MIN = 26

/**
 * Número de destaque que cabe na sua coluna: começa em 56px e encolhe na proporção do que sobrar
 * (nunca abaixo de 26px). Mede a cada render e quando a coluna muda de largura.
 */
export function HeroValue({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const fit = () => {
      const inner = box.firstElementChild as HTMLElement | null
      if (!inner) return
      box.style.fontSize = `${MAX}px`
      const available = box.clientWidth
      const needed = inner.scrollWidth
      box.style.fontSize = `${needed > available && needed > 0 ? Math.max(MIN, Math.floor((MAX * available) / needed)) : MAX}px`
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  })
  return <div ref={ref} className="min-w-0 overflow-hidden" style={{ fontSize: MAX }}>{children}</div>
}

type Props = {
  /** Linha de cima (saudação, moeda, ações pequenas). */
  top?: ReactNode
  /** O número grande (um <Amount smallSymbol className={HERO_NUMBER}>). */
  value: ReactNode
  /** O que o número é ("Disponível no mês"); dá nome à seção. */
  label: ReactNode
  /** Linhas abaixo do rótulo (outras moedas, "de R$ x"). */
  detail?: ReactNode
  /** O anel à direita (~100px). */
  ring: ReactNode
  /** Legenda curta do anel, logo abaixo do rótulo. */
  caption?: ReactNode
  /** Conteúdo depois do número e do anel (ações, listas). */
  children?: ReactNode
  className?: string
}

/** Cartão de destaque: número enorme e rótulo à esquerda, anel à direita — lado a lado em qualquer largura. */
export function HeroCard({ top, value, label, detail, ring, caption, children, className = '' }: Props) {
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className={`rounded-card bg-surface p-5 sm:p-6 ${className}`}>
      {top && <div className="mb-2 flex min-h-11 items-center justify-between gap-3">{top}</div>}
      <div className="flex items-center justify-between gap-3 sm:gap-5">
        <div className="min-w-0 flex-1">
          <HeroValue>{value}</HeroValue>
          <p id={labelId} className="mt-1.5 text-[15px] font-semibold text-balance text-muted">{label}</p>
          {detail}
          {caption && <p className="mt-1 text-[13px] font-semibold text-muted">{caption}</p>}
        </div>
        <div className="shrink-0">{ring}</div>
      </div>
      {children}
    </section>
  )
}
