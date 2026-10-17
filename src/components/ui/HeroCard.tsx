import { useId, type ReactNode } from 'react'

/** Número enorme do destaque (como no Início): cresce com o cartão, até 56px. */
export const HERO_NUMBER = 'block text-[clamp(2.25rem,13cqi,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.04em]'

type Props = {
  /** Linha de cima (saudação, moeda, ações pequenas). */
  top?: ReactNode
  /** O número grande (normalmente um <Amount className={HERO_NUMBER}>). */
  value: ReactNode
  /** O que o número é ("Restante este mês"); dá nome à seção. */
  label: ReactNode
  /** Linhas abaixo do rótulo (outras moedas, "de R$ x"). */
  detail?: ReactNode
  /** O anel grande à direita (<Ring size={112}> ou <SegmentedRing>). */
  ring: ReactNode
  /** Legenda curta do anel. */
  caption?: ReactNode
  /** Conteúdo depois do número e do anel (ações, listas). */
  children?: ReactNode
  className?: string
}

/** Cartão de destaque: número enorme e rótulo à esquerda, anel grande à direita (empilha em cartões estreitos). */
export function HeroCard({ top, value, label, detail, ring, caption, children, className = '' }: Props) {
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className={`@container rounded-card bg-surface p-5 sm:p-6 ${className}`}>
      {top && <div className="mb-2 flex min-h-11 items-center justify-between gap-3">{top}</div>}
      <div className="flex flex-col gap-4 @md:flex-row @md:items-center @md:justify-between">
        <div className="min-w-0">
          {value}
          <p id={labelId} className="mt-1.5 text-[15px] font-semibold text-muted">{label}</p>
          {detail}
        </div>
        <div className="flex items-center justify-between gap-4 @md:flex-col-reverse @md:items-end">
          {caption ? <p className="max-w-[12rem] text-[13px] font-semibold text-muted @md:text-right">{caption}</p> : <span />}
          {ring}
        </div>
      </div>
      {children}
    </section>
  )
}
