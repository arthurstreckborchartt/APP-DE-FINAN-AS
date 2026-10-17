import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Delete } from 'lucide-react'
import { appendDigit, removeDigit } from '../../lib/amount'
import { formatMoney } from '../../lib/money'

type Props = {
  value: number
  onChange: (cents: number) => void
  currency: string
  locale: string
  label: string
  error?: string
  /** Cor do valor: verde para receita. */
  tone?: 'income' | 'expense'
}

function Key({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="num grid h-14 place-items-center field rounded-[20px] text-[24px] font-bold text-fg transition duration-100
        hover:bg-surface-2 active:scale-95 active:bg-surface-3 dark:bg-surface-2 dark:hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-primary">
      {children}
    </button>
  )
}

export function AmountKeypad({ value, onChange, currency, locale, label, error, tone }: Props) {
  const { t } = useTranslation()
  const errorId = useId()
  const press = (digit: number) => onChange(appendDigit(value, digit))

  const latest = useRef({ value, onChange })
  useEffect(() => {
    latest.current = { value, onChange }
  })

  // Teclado físico (PC): dígitos e Backspace funcionam na tela toda, exceto dentro de outros campos.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      const { value: v, onChange: change } = latest.current
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        change(appendDigit(v, Number(e.key)))
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        change(removeDigit(v))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div role="textbox" tabIndex={0} aria-label={label} aria-readonly="true" aria-live="polite"
        aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
        className={`num rounded-2xl px-2 py-4 text-center text-[44px] leading-tight sm:text-[52px] break-all font-extrabold tracking-[-0.035em] outline-none
          focus-visible:ring-2 focus-visible:ring-primary ${value === 0 ? 'text-muted' : tone === 'income' ? 'text-success' : 'text-fg'}`}>
        {formatMoney(value, currency, locale)}
      </div>
      {error && <p id={errorId} role="alert" className="text-center text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Key key={d} onClick={() => press(d)}>{d}</Key>
        ))}
        <Key onClick={() => onChange(appendDigit(appendDigit(value, 0), 0))}>00</Key>
        <Key onClick={() => press(0)}>0</Key>
        <Key onClick={() => onChange(removeDigit(value))} label={t('transactions.backspace')}>
          <Delete className="size-6" aria-hidden="true" />
        </Key>
      </div>
    </div>
  )
}
