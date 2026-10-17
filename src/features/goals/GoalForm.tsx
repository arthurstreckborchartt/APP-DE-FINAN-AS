import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, MAX_AMOUNT_CENTS, parseAmount } from '../../lib/amount'
import { onCardDark } from '../../lib/contrast'
import { normalizeLocale } from '../../lib/locale'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import { CATEGORY_ICONS } from '../categories/icons'
import { useCreateGoal, useUpdateGoal } from './api'
import type { Goal } from './types'

export const GOAL_ICONS = [
  'piggy-bank', 'plane', 'home', 'car', 'graduation-cap', 'heart', 'gift', 'umbrella', 'laptop', 'baby',
] as const

/** 8 cores da paleta das categorias. */
export const GOAL_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#22c55e', '#f97316', '#ef4444', '#ec4899'] as const

type Props = {
  /** Meta em edição; sem ela, cria uma nova. */
  goal?: Goal
  /** Moeda inicial de uma meta nova (a do perfil). */
  currency: CurrencyCode
  onDone: (id: string) => void
}

export function GoalForm({ goal, currency: initialCurrency, onDone }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const create = useCreateGoal()
  const update = useUpdateGoal()
  const busy = create.isPending || update.isPending
  const [name, setName] = useState(goal?.name ?? '')
  const [amountText, setAmountText] = useState(goal ? formatAmountPlain(goal.target_amount, locale) : '')
  const [currency, setCurrency] = useState<CurrencyCode>(goal?.currency ?? initialCurrency)
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [icon, setIcon] = useState<string>(goal?.icon ?? GOAL_ICONS[0])
  const [color, setColor] = useState<string>(goal?.color ?? GOAL_COLORS[0])
  const [nameError, setNameError] = useState<string>()
  const [amountError, setAmountError] = useState<string>()
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    const trimmed = name.trim()
    const cents = parseAmount(amountText)
    const nameBad = trimmed.length < 1 || trimmed.length > 40
    const amountBad = cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS
    setNameError(nameBad ? t('goals.nameRequired') : undefined)
    setAmountError(amountBad ? t('goals.invalidAmount') : undefined)
    if (nameBad || cents === null || amountBad) return
    const fields = { name: trimmed, target_amount: cents, deadline: deadline || null, icon, color }
    try {
      if (goal) {
        await update.mutateAsync({ id: goal.id, patch: fields })
        onDone(goal.id)
      } else {
        onDone(await create.mutateAsync({ ...fields, currency }))
      }
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <span className="pb-0.5"><CategoryIcon icon={icon} color={color} /></span>
        <TextField className="flex-1" label={t('goals.name')} maxLength={40} value={name} error={nameError}
          onChange={(e) => { setName(e.target.value); setNameError(undefined) }} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <TextField label={t('goals.target')} inputMode="decimal" placeholder={formatAmountPlain(0, locale)}
          value={amountText} error={amountError}
          onChange={(e) => { setAmountText(e.target.value); setAmountError(undefined) }} />
        {goal ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">{t('goals.currency')}</span>
            <span className="grid h-12 place-items-center rounded-2xl bg-surface-2 px-4 text-[15px] font-extrabold text-muted">{currency}</span>
          </div>
        ) : (
          <SelectField label={t('goals.currency')} value={currency} disabled={busy} className="w-28"
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
            {CURRENCIES.map((c) => <option key={c} value={c} title={currencyName(c, locale)}>{c}</option>)}
          </SelectField>
        )}
      </div>

      <TextField label={t('goals.deadline')} type="date" min="2000-01-01" max="2100-12-31"
        value={deadline} onChange={(e) => setDeadline(e.target.value)} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-muted">{t('goals.icon')}</legend>
        <div className="grid grid-cols-5 gap-2">
          {GOAL_ICONS.map((name, i) => {
            const Icon = CATEGORY_ICONS[name]
            return (
              <label key={name} className="grid aspect-square max-h-14 cursor-pointer place-items-center rounded-2xl border-2 border-transparent bg-surface-2 text-muted transition hover:bg-surface-3
                has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary
                has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface">
                <input type="radio" name="goal-icon" value={name} className="sr-only" checked={icon === name}
                  onChange={() => setIcon(name)} aria-label={t('categories.iconOption', { n: i + 1 })} />
                <Icon className="size-5" aria-hidden="true" />
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-muted">{t('goals.color')}</legend>
        <div className="grid w-fit grid-cols-4 gap-2 sm:grid-cols-8">
          {GOAL_COLORS.map((c, i) => (
            <label key={c} className="grid size-11 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface
              has-checked:ring-2 has-checked:ring-fg has-focus-visible:ring-2 has-focus-visible:ring-primary" style={{ backgroundColor: c }}>
              <input type="radio" name="goal-color" value={c} className="sr-only" checked={color === c}
                onChange={() => setColor(c)} aria-label={t('categories.colorOption', { n: i + 1 })} />
              {color === c && <Check className={`size-5 ${onCardDark(c) ? 'text-[#110e24]' : 'text-white'}`} aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full loading={busy}>{t('goals.save')}</Button>
    </form>
  )
}
