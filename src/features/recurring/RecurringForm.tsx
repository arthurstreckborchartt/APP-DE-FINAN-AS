import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, parseAmount } from '../../lib/amount'
import { todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import type { Frequency } from '../../lib/recurrence'
import type { Account } from '../accounts/types'
import type { Card } from '../cards/types'
import { categoryLabel } from '../categories/label'
import { GroupPicker } from '../groups/GroupPicker'
import type { Category } from '../categories/types'
import type { TransactionKind } from '../transactions/types'
import type { Recurring, RecurringInput } from './types'

type Props = {
  /** Recorrente em edição; ausente ao criar. */
  recurring?: Recurring
  accounts: Account[]
  cards: Card[]
  categories: Category[]
  loading?: boolean
  error?: string | null
  onSubmit: (value: RecurringInput) => void
  children?: ReactNode
}

type Errors = Partial<Record<'amount' | 'category' | 'source' | 'start' | 'end', string>>

export function RecurringForm({ recurring, accounts, cards, categories, loading, error, onSubmit, children }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const editing = !!recurring
  const [kind, setKind] = useState<TransactionKind>(recurring?.kind ?? 'expense')
  const [amountText, setAmountText] = useState(recurring ? formatAmountPlain(recurring.amount, locale) : '')
  const [categoryId, setCategoryId] = useState<string | null>(
    recurring?.category_id ?? categories.find((c) => !c.archived && c.kind === 'expense')?.id ?? null,
  )
  const [source, setSource] = useState<'account' | 'card'>(recurring?.card_id ? 'card' : 'account')
  const [accountId, setAccountId] = useState<string | null>(
    recurring ? recurring.account_id : accounts.find((a) => !a.archived)?.id ?? null,
  )
  const [cardId, setCardId] = useState<string | null>(
    recurring ? recurring.card_id : cards.find((c) => !c.archived)?.id ?? null,
  )
  const [frequency, setFrequency] = useState<Frequency>(recurring?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(recurring?.start_date ?? todayISO())
  const [endDate, setEndDate] = useState(recurring?.end_date ?? '')
  const [description, setDescription] = useState(recurring?.description ?? '')
  const [groupId, setGroupId] = useState<string | null>(recurring?.group_id ?? null)
  const [errors, setErrors] = useState<Errors>({})

  // Origens arquivadas ficam ocultas, exceto a que a recorrente já usa.
  const selectableAccounts = accounts.filter((a) => !a.archived || a.id === recurring?.account_id)
  const selectableCards = cards.filter((c) => !c.archived || c.id === recurring?.card_id)
  const showSource = kind === 'expense' && selectableCards.length > 0
  const onCard = kind === 'expense' && source === 'card'
  const sourceCurrency = onCard ? cards.find((c) => c.id === cardId)?.currency : accounts.find((a) => a.id === accountId)?.currency
  const selectableCategories = categories.filter(
    (c) => c.kind === kind && (!c.archived || c.id === categoryId),
  )

  function changeKind(next: TransactionKind) {
    if (next === kind) return
    setKind(next)
    setCategoryId(categories.find((c) => !c.archived && c.kind === next)?.id ?? null)
    if (next === 'income') {
      setSource('account')
      setAccountId((cur) => cur ?? selectableAccounts[0]?.id ?? null)
    }
    setErrors({})
  }

  function changeSource(next: 'account' | 'card') {
    if (next === source) return
    setSource(next)
    if (next === 'card') setCardId((cur) => cur ?? selectableCards[0]?.id ?? null)
    else setAccountId((cur) => cur ?? selectableAccounts[0]?.id ?? null)
    setErrors({})
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    const cents = parseAmount(amountText)
    if (cents === null || cents <= 0) next.amount = t('recurring.invalidAmount')
    if (!categoryId) next.category = t('transactions.errors.category')
    if (onCard ? !cardId : !accountId) next.source = t(onCard ? 'transactions.errors.card' : 'transactions.errors.account')
    if (!startDate) next.start = t('transactions.errors.date')
    if (endDate && endDate < startDate) next.end = t('recurring.endBeforeStart')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      kind, amount: cents!, category_id: categoryId!, description: description.trim(), frequency,
      start_date: startDate, end_date: endDate || null,
      account_id: onCard ? null : accountId, card_id: onCard ? cardId : null,
      group_id: groupId,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {editing ? (
        <>
          <p className="text-[15px] font-bold">
            {t(kind === 'income' ? 'transactions.income' : 'transactions.expense')}
            <span className="font-medium text-muted">
              {' · '}{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${startDate}T00:00:00`))}
            </span>
          </p>
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] font-medium text-muted">{t('recurring.editHint')}</p>
        </>
      ) : (
        <SegmentedControl label={t('transactions.kindFilter')} value={kind} onChange={changeKind}
          options={[
            { value: 'expense', label: t('transactions.expense') },
            { value: 'income', label: t('transactions.income') },
          ]} />
      )}

      <TextField label={t('recurring.amount')} inputMode="decimal" placeholder={formatAmountPlain(0, locale)}
        value={amountText} error={errors.amount}
        onChange={(e) => { setAmountText(e.target.value); setErrors({}) }} />

      <fieldset>
        <legend className="mb-3 text-[13px] font-semibold text-muted">{t('transactions.category')}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {selectableCategories.map((c) => (
            <label key={c.id} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-transparent bg-surface-2 px-1.5 py-3 text-center transition
              hover:bg-surface-3 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-4 has-focus-visible:ring-primary/25">
              <input type="radio" name="category" className="sr-only" value={c.id} checked={categoryId === c.id}
                onChange={() => { setCategoryId(c.id); setErrors({}) }} />
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="line-clamp-2 text-[12px] font-bold leading-tight">{categoryLabel(c, t)}</span>
            </label>
          ))}
        </div>
        {errors.category && <p className="mt-2 text-[13px] font-medium text-danger">{errors.category}</p>}
      </fieldset>

      {showSource && (
        <SegmentedControl label={t('transactions.source')} value={source} onChange={changeSource}
          options={[
            { value: 'account', label: t('transactions.sourceAccount') },
            { value: 'card', label: t('transactions.sourceCard') },
          ]} />
      )}
      <div>
        {onCard ? (
          <SelectField label={t('transactions.card')} value={cardId ?? ''}
            onChange={(e) => { setCardId(e.target.value || null); setErrors({}) }}>
            <option value="" disabled>—</option>
            {selectableCards.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>)}
          </SelectField>
        ) : (
          <SelectField label={t('transactions.account')} value={accountId ?? ''}
            onChange={(e) => { setAccountId(e.target.value || null); setErrors({}) }}>
            <option value="" disabled>—</option>
            {selectableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </SelectField>
        )}
        {errors.source && <p className="mt-1.5 text-[13px] font-medium text-danger">{errors.source}</p>}
      </div>

      <SegmentedControl label={t('recurring.frequency')} value={frequency} onChange={setFrequency}
        options={[
          { value: 'weekly', label: t('recurring.weekly') },
          { value: 'monthly', label: t('recurring.monthly') },
          { value: 'yearly', label: t('recurring.yearly') },
        ]} />

      <div className="grid gap-4 sm:grid-cols-2">
        {!editing && (
          <TextField label={t('recurring.startDate')} type="date" value={startDate} error={errors.start}
            onChange={(e) => { setStartDate(e.target.value); setErrors({}) }} />
        )}
        <TextField label={t('recurring.endDate')} type="date" value={endDate} error={errors.end}
          onChange={(e) => { setEndDate(e.target.value); setErrors({}) }} />
      </div>

      <GroupPicker value={groupId} currency={sourceCurrency} onChange={setGroupId} />

      <TextField label={t('transactions.description')} maxLength={140} placeholder={t('transactions.descriptionPlaceholder')}
        value={description} onChange={(e) => setDescription(e.target.value)} />

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{t('common.save')}</Button>
      {children}
    </form>
  )
}
