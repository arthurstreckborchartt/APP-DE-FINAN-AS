import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, parseAmount } from '../../lib/amount'
import { normalizeLocale } from '../../lib/locale'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import { CATEGORY_COLORS } from '../categories/icons'
import type { CardInput } from './types'

export const CARD_COLORS = ['#5b3df5', ...CATEGORY_COLORS]
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

type Props = {
  initial: CardInput
  currencyEditable: boolean
  submitLabel: string
  loading?: boolean
  error?: string | null
  onSubmit: (value: CardInput) => void
  children?: ReactNode
}

export function CardForm({ initial, currencyEditable, submitLabel, loading, error, onSubmit, children }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [name, setName] = useState(initial.name)
  const [limitText, setLimitText] = useState(initial.limit_amount ? formatAmountPlain(initial.limit_amount, locale) : '')
  const [limitError, setLimitError] = useState<string | undefined>()
  const [closingDay, setClosingDay] = useState(initial.closing_day)
  const [dueDay, setDueDay] = useState(initial.due_day)
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency)
  const [color, setColor] = useState(initial.color)

  function submit(e: FormEvent) {
    e.preventDefault()
    const cents = parseAmount(limitText)
    if (cents === null || cents <= 0) return setLimitError(t('cards.invalidLimit'))
    setLimitError(undefined)
    onSubmit({ name: name.trim(), limit_amount: cents, closing_day: closingDay, due_day: dueDay, currency, color })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label={t('cards.name')} required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label={t('cards.limit')} inputMode="decimal" placeholder={formatAmountPlain(0, locale)}
        value={limitText} error={limitError} onChange={(e) => { setLimitText(e.target.value); setLimitError(undefined) }} />
      <div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label={t('cards.closingDay')} value={closingDay} onChange={(e) => setClosingDay(Number(e.target.value))}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </SelectField>
          <SelectField label={t('cards.dueDay')} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </SelectField>
        </div>
        <p className="mt-1 text-xs text-muted">{t('cards.dayHint')}</p>
      </div>
      {currencyEditable && (
        <SelectField label={t('accounts.currency')} value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {currencyName(c, locale)}</option>)}
        </SelectField>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('cards.color')}</legend>
        <div className="flex flex-wrap gap-2">
          {CARD_COLORS.map((c, i) => (
            <label key={c} className="grid size-10 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface
              has-checked:ring-2 has-checked:ring-fg has-focus-visible:ring-2 has-focus-visible:ring-primary" style={{ backgroundColor: c }}>
              <input type="radio" name="color" value={c} className="sr-only" checked={color === c}
                onChange={() => setColor(c)} aria-label={t('categories.colorOption', { n: i + 1 })} />
              {color === c && <Check className="size-5 text-white" aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
      {children}
    </form>
  )
}
