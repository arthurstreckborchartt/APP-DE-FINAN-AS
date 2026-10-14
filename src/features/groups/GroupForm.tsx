import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { normalizeLocale } from '../../lib/locale'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import { GROUP_ICON_NAMES, groupIconComponent } from './GroupIcon'
import type { GroupInput } from './types'

type Props = {
  initial: GroupInput
  submitLabel: string
  loading?: boolean
  error?: string | null
  onSubmit: (value: GroupInput) => void
}

export function GroupForm({ initial, submitLabel, loading, error, onSubmit }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [name, setName] = useState(initial.name)
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency)
  const [icon, setIcon] = useState(initial.icon)
  const [nameError, setNameError] = useState<string | undefined>()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 40) return setNameError(t('common.errorGeneric'))
    setNameError(undefined)
    onSubmit({ name: trimmed, currency, icon })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label={t('groups.name')} required maxLength={40} value={name} error={nameError}
        onChange={(e) => { setName(e.target.value); setNameError(undefined) }} />
      <div>
        <SelectField label={t('groups.currency')} value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {currencyName(c, locale)}</option>)}
        </SelectField>
        <p className="mt-1 text-xs text-muted">{t('groups.currencyHint')}</p>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-muted">{t('groups.icon')}</p>
        <div className="grid grid-cols-5 gap-2">
          {GROUP_ICON_NAMES.map((n) => {
            const Icon = groupIconComponent(n)
            const on = icon === n
            return (
              <button key={n} type="button" aria-pressed={on} aria-label={n} onClick={() => setIcon(n)}
                className={`grid h-12 place-items-center rounded-2xl transition ${on ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
                <Icon className="size-5" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
    </form>
  )
}
