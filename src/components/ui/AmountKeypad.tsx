import type { KeyboardEvent, ReactNode } from 'react'
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
}

function Key({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="grid h-14 place-items-center rounded-2xl bg-surface-2 text-2xl font-semibold text-fg transition
        active:scale-95 hover:bg-line focus-visible:outline-2 focus-visible:outline-primary">
      {children}
    </button>
  )
}

export function AmountKeypad({ value, onChange, currency, locale, label, error }: Props) {
  const { t } = useTranslation()
  const press = (digit: number) => onChange(appendDigit(value, digit))

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      press(Number(e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      onChange(removeDigit(value))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="textbox" tabIndex={0} aria-label={label} aria-readonly="true" aria-live="polite"
        aria-invalid={error ? true : undefined} onKeyDown={onKeyDown}
        className={`rounded-2xl px-4 py-3 text-center text-4xl font-bold tabular-nums outline-none
          focus-visible:ring-2 focus-visible:ring-primary ${value === 0 ? 'text-muted' : 'text-fg'}`}>
        {formatMoney(value, currency, locale)}
      </div>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
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
