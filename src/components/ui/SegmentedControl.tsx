import { useRef, type KeyboardEvent } from 'react'

type Option<T extends string> = { value: T; label: string }
type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }

export function SegmentedControl<T extends string>({ value, options, onChange, label }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const hasMatch = options.some((o) => o.value === value)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = options.findIndex((o) => o.value === value)
    const n = options.length
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown}
      className="grid auto-cols-fr grid-flow-col gap-1 field rounded-full p-1 dark:bg-surface-2">
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={checked}
            tabIndex={checked || (!hasMatch && i === 0) ? 0 : -1} onClick={() => onChange(o.value)}
            className={`h-11 rounded-full text-sm font-bold transition duration-200 focus-visible:outline-2 focus-visible:outline-primary ${
              checked ? 'bg-ink text-ink-fg' : 'text-muted hover:text-fg'
            }`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
