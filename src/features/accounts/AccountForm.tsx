import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, parseAmount } from '../../lib/amount'
import { normalizeLocale } from '../../lib/locale'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import { ACCOUNT_TYPES, type AccountInput, type AccountType } from './types'

type Props = {
  initial: AccountInput
  currencyEditable: boolean
  submitLabel: string
  loading?: boolean
  error?: string | null
  onSubmit: (value: AccountInput) => void
  children?: ReactNode
}

export function AccountForm({ initial, currencyEditable, submitLabel, loading, error, onSubmit, children }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [name, setName] = useState(initial.name)
  const [type, setType] = useState<AccountType>(initial.type)
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency)
  const [balanceText, setBalanceText] = useState(
    initial.initial_balance ? formatAmountPlain(initial.initial_balance, locale) : '',
  )
  const [balanceError, setBalanceError] = useState<string | undefined>()

  function submit(e: FormEvent) {
    e.preventDefault()
    const cents = balanceText.trim() === '' ? 0 : parseAmount(balanceText)
    if (cents === null) return setBalanceError(t('accounts.invalidBalance'))
    setBalanceError(undefined)
    onSubmit({ name: name.trim(), type, currency, initial_balance: cents })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label={t('accounts.name')} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <SelectField label={t('accounts.type')} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
        {ACCOUNT_TYPES.map((v) => <option key={v} value={v}>{t(`accounts.types.${v}`)}</option>)}
      </SelectField>
      <div>
        <SelectField label={t('accounts.currency')} value={currency} disabled={!currencyEditable}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {currencyName(c, locale)}</option>)}
        </SelectField>
        {!currencyEditable && <p className="mt-1 text-xs text-muted">{t('accounts.currencyLocked')}</p>}
      </div>
      <TextField label={t('accounts.initialBalance')} inputMode="decimal" placeholder={formatAmountPlain(0, locale)}
        value={balanceText} error={balanceError} onChange={(e) => setBalanceText(e.target.value)} />
      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
      {children}
    </form>
  )
}
