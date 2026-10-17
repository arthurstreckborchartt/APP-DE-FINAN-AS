import { useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

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

type RadioOption = { value: string; label: string; checked: boolean }

/**
 * Grupo de pílulas (role=radiogroup) com foco itinerante: só a marcada entra no Tab; setas, Home e
 * End movem o foco e escolhem, como no SegmentedControl. Rola na horizontal quando não cabe.
 */
export function ChipRadioGroup({ label, options, onChange }: {
  label: string
  options: RadioOption[]
  onChange: (value: string) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = options.findIndex((o) => o.checked)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const n = options.length
    const from = current < 0 ? 0 : current
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (from + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (from - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {options.map((o, i) => (
        <button key={o.value} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={o.checked}
          tabIndex={o.checked || (current < 0 && i === 0) ? 0 : -1} onClick={() => onChange(o.value)} className={CHIP_BUTTON}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
