import type { InputHTMLAttributes, ReactNode } from 'react'

/**
 * Escolhas do mundo Cal AI: pílulas e ladrilhos no preenchimento `field` (Cloud sobre o branco, branco
 * dentro de um cartão Cloud); a opção marcada vira tinta (preto no claro, branco no escuro).
 */

const FOCUS = 'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary'
const DISABLED = 'has-disabled:cursor-not-allowed has-disabled:opacity-50'

/** Pílula de rádio (o <input> fica dentro do <label>). */
export const CHIP = `field inline-flex h-11 shrink-0 cursor-pointer select-none items-center gap-2 rounded-full px-4 text-[13px] font-bold text-fg transition
  not-has-checked:not-has-disabled:hover:bg-surface-2 has-checked:bg-ink has-checked:text-ink-fg ${FOCUS} ${DISABLED}`

/** Pílula para <button role="radio" aria-checked>. */
export const CHIP_BUTTON = `field inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-bold text-fg transition
  not-aria-checked:hover:bg-surface-2 aria-checked:bg-ink aria-checked:text-ink-fg
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`

/** Ladrilho quadrado arredondado de rádio (categorias, ícones). */
export const TILE = `field flex cursor-pointer select-none flex-col items-center justify-center gap-1.5 rounded-[20px] text-center transition
  not-has-checked:hover:bg-surface-2 has-checked:bg-ink has-checked:text-ink-fg ${FOCUS} ${DISABLED}`

/** Ladrilho de ícone para <button aria-pressed>. */
export const TILE_BUTTON = `field grid h-12 place-items-center rounded-[18px] text-muted transition
  not-aria-pressed:hover:bg-surface-2 not-aria-pressed:hover:text-fg aria-pressed:bg-ink aria-pressed:text-ink-fg
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'children'> & {
  children: ReactNode
  className?: string
}

/** Pílula de escolha única (rádio acessível, visualmente uma pílula). */
export function ChoiceChip({ children, className = '', ...input }: ChoiceProps) {
  return (
    <label className={`${CHIP} ${className}`}>
      <input type="radio" className="sr-only" {...input} />
      {children}
    </label>
  )
}

/** Ladrilho de escolha única (categoria com ícone e nome, ou só ícone). */
export function ChoiceTile({ children, className = 'px-1.5 py-3', ...input }: ChoiceProps) {
  return (
    <label className={`${TILE} ${className}`}>
      <input type="radio" className="sr-only" {...input} />
      {children}
    </label>
  )
}
