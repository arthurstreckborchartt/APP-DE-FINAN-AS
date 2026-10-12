import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Wallet } from 'lucide-react'
import { AmountKeypad } from '../../components/ui/AmountKeypad'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/SelectField'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { CategoryIcon } from '../../components/CategoryIcon'
import { formatMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { isPaidInvoiceError } from '../../lib/db-errors'
import { invoiceMonthFor, splitInstallments } from '../../lib/invoice'
import { formatMoney } from '../../lib/money'
import { useHideValues } from '../../lib/privacy'
import { useAccounts } from '../accounts/api'
import { useCards } from '../cards/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useProfile } from '../profile/api'
import { useCreateTransaction, useDeleteTransaction, useRecentTransactions, useTransaction, useUpdateTransaction } from './api'
import { pickDefaults } from './defaults'
import type { TransactionKind } from './types'

type Draft = {
  kind: TransactionKind
  amount: number
  categoryId: string | null
  accountId: string | null
  source: 'account' | 'card'
  cardId: string | null
  installments: number
  date: string
  description: string
}

type Errors = Partial<Record<'amount' | 'category' | 'account' | 'card' | 'date', string>>

export default function TransactionFormPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const accountsQuery = useAccounts()
  const cardsQuery = useCards()
  const hidden = useHideValues()
  const categoriesQuery = useCategories()
  const recentQuery = useRecentTransactions()
  const recent = useMemo(() => recentQuery.data ?? [], [recentQuery.data])
  const recentSettled = !recentQuery.isPending
  const existingQuery = useTransaction(id)
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [saveError, setSaveError] = useState<'generic' | 'locked' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const accounts = accountsQuery.data
  const cards = cardsQuery.data
  const categories = categoriesQuery.data
  const existing = existingQuery.data

  const base = useMemo<Draft | null>(() => {
    if (!accounts || !categories || !cards) return null
    if (id) {
      if (!existing) return null
      return {
        kind: existing.kind, amount: existing.amount, categoryId: existing.category_id,
        accountId: existing.account_id, source: existing.card_id ? 'card' : 'account', cardId: existing.card_id,
        installments: existing.installments_count, date: existing.date, description: existing.description,
      }
    }
    if (!recentSettled) return null
    const activeAccounts = accounts.filter((a) => !a.archived).map((a) => a.id)
    const activeCats = categories.filter((c) => !c.archived && c.kind === 'expense').map((c) => c.id)
    const d = pickDefaults(recent, 'expense', activeAccounts, activeCats)
    // Se a última despesa foi no cartão (ativo), começa em "Cartão" com esse cartão.
    const lastExpense = recent.find((r) => r.kind === 'expense')
    const lastCard = lastExpense?.card_id ? cards.find((c) => c.id === lastExpense.card_id && !c.archived) : undefined
    return {
      kind: 'expense', amount: 0, categoryId: d.categoryId, accountId: d.accountId,
      source: lastCard ? 'card' : 'account', cardId: lastCard?.id ?? null, installments: 1,
      date: todayISO(), description: '',
    }
  }, [id, existing, accounts, categories, cards, recent, recentSettled])

  if (remove.isPending || remove.isSuccess) return <FullScreenSpinner />
  if (accountsQuery.isError || cardsQuery.isError || categoriesQuery.isError || existingQuery.isError) {
    return <QueryError onRetry={() => {
      void accountsQuery.refetch()
      void cardsQuery.refetch()
      void categoriesQuery.refetch()
      if (id) void existingQuery.refetch()
    }} />
  }
  if (!base || !accounts || !categories || !cards) return <FullScreenSpinner />

  const form = draft ?? base
  const selectableAccounts = accounts.filter((a) => !a.archived || a.id === form.accountId)
  const selectableCards = cards.filter((c) => !c.archived || c.id === form.cardId)
  if (selectableAccounts.length === 0 && selectableCards.length === 0) {
    return (
      <EmptyState icon={Wallet} title={t('transactions.noAccounts')}
        action={<Link to="/accounts" className="font-semibold text-primary">{t('transactions.goToAccounts')}</Link>} />
    )
  }
  const showSource = form.kind === 'expense' && selectableCards.length > 0
  const onCard = form.kind === 'expense' && form.source === 'card'
  const card = onCard ? cards.find((c) => c.id === form.cardId) : undefined

  const selectableCategories = categories.filter(
    (c) => c.kind === form.kind && (!c.archived || c.id === form.categoryId),
  )
  const account = accounts.find((a) => a.id === form.accountId)
  const currency = (onCard ? card?.currency : account?.currency) ?? profile?.currency ?? 'BRL'

  function set(patch: Partial<Draft>) {
    setDraft({ ...form, ...patch })
    setSaveError(null)
    setErrors({})
    setConfirmDelete(false)
  }

  function changeKind(kind: TransactionKind) {
    if (kind === form.kind) return
    const activeCats = categories!.filter((c) => !c.archived && c.kind === kind).map((c) => c.id)
    const activeAccounts = accounts!.filter((a) => !a.archived).map((a) => a.id)
    const d = pickDefaults(recent, kind, activeAccounts, activeCats)
    // Receita só existe em conta.
    set({ kind, categoryId: d.categoryId, ...(kind === 'income' ? { source: 'account' as const, installments: 1, accountId: form.accountId ?? d.accountId } : {}) })
  }

  function changeSource(source: 'account' | 'card') {
    if (source === form.source) return
    if (source === 'card') {
      const first = selectableCards[0]
      set({ source, cardId: form.cardId ?? first?.id ?? null })
    } else {
      const activeAccounts = accounts!.filter((a) => !a.archived).map((a) => a.id)
      const d = pickDefaults(recent, 'expense', activeAccounts, [])
      set({ source, installments: 1, accountId: form.accountId ?? d.accountId })
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (form.amount <= 0) next.amount = t('transactions.errors.amount')
    if (!form.categoryId) next.category = t('transactions.errors.category')
    if (!form.date) next.date = t('transactions.errors.date')
    if (onCard) {
      if (!form.cardId) next.card = t('transactions.errors.card')
    } else if (!form.accountId) next.account = t('transactions.errors.account')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input = {
      kind: form.kind, amount: form.amount, date: form.date, category_id: form.categoryId!,
      description: form.description.trim(),
      ...(onCard
        ? { account_id: null, card_id: form.cardId!, installments_count: form.installments }
        : { account_id: form.accountId!, card_id: null, installments_count: 1 }),
    }
    try {
      if (id) await update.mutateAsync({ id, input })
      else await create.mutateAsync(input)
      navigate(`/transactions?m=${monthOf(form.date)}`, { replace: true })
    } catch (e) {
      setSaveError(isPaidInvoiceError(e) ? 'locked' : 'generic')
    }
  }

  async function onDelete() {
    if (!id) return
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(id)
      navigate(`/transactions?m=${monthOf(form.date)}`, { replace: true })
    } catch (e) {
      setConfirmDelete(false)
      setSaveError(isPaidInvoiceError(e) ? 'locked' : 'generic')
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')}
          className="-ml-2 grid size-11 place-items-center rounded-full text-fg transition hover:bg-surface-2">
          <ChevronLeft className="size-6" aria-hidden="true" />
        </button>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{id ? t('transactions.edit') : t('transactions.new')}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6">
        <section className="flex flex-col gap-5 rounded-[28px] bg-surface p-5 shadow-sheet sm:p-6 lg:sticky lg:top-10">
          <SegmentedControl label={t('transactions.kindFilter')} value={form.kind} onChange={changeKind}
            options={[
              { value: 'expense', label: t('transactions.expense') },
              { value: 'income', label: t('transactions.income') },
            ]} />
          <AmountKeypad value={form.amount} onChange={(amount) => set({ amount })} currency={currency} locale={locale}
            label={t('transactions.amount')} error={errors.amount} tone={form.kind} />
        </section>

        <section className="flex flex-col gap-6 rounded-[28px] bg-surface p-5 shadow-sheet sm:p-6">
          <fieldset>
            <legend className="mb-3 text-[13px] font-semibold text-muted">{t('transactions.category')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selectableCategories.map((c) => (
                <label key={c.id} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-transparent bg-surface-2 px-1.5 py-3 text-center transition
                  hover:bg-surface-3 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-4 has-focus-visible:ring-primary/25">
                  <input type="radio" name="category" className="sr-only" value={c.id} checked={form.categoryId === c.id}
                    onChange={() => set({ categoryId: c.id })} />
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="line-clamp-2 text-[12px] font-bold leading-tight">{categoryLabel(c, t)}</span>
                </label>
              ))}
            </div>
            {errors.category && <p className="mt-2 text-[13px] font-medium text-danger">{errors.category}</p>}
          </fieldset>

          {showSource && (
            <SegmentedControl label={t('transactions.source')} value={form.source}
              onChange={changeSource}
              options={[
                { value: 'account', label: t('transactions.sourceAccount') },
                { value: 'card', label: t('transactions.sourceCard') },
              ]} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {onCard ? (
              <div>
                <SelectField label={t('transactions.card')} value={form.cardId ?? ''}
                  onChange={(e) => set({ cardId: e.target.value || null })}>
                  <option value="" disabled>—</option>
                  {selectableCards.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>)}
                </SelectField>
                {errors.card && <p className="mt-1.5 text-[13px] font-medium text-danger">{errors.card}</p>}
              </div>
            ) : (
              <div>
                <SelectField label={t('transactions.account')} value={form.accountId ?? ''}
                  onChange={(e) => set({ accountId: e.target.value || null })}>
                  <option value="" disabled>—</option>
                  {selectableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                </SelectField>
                {errors.account && <p className="mt-1.5 text-[13px] font-medium text-danger">{errors.account}</p>}
              </div>
            )}
            <TextField label={t('transactions.date')} type="date" value={form.date}
              onChange={(e) => set({ date: e.target.value })} error={errors.date} />
          </div>

          {onCard && card && (
            <div className="flex flex-col gap-2">
              <SelectField label={t('transactions.installments')} value={String(form.installments)}
                onChange={(e) => set({ installments: Number(e.target.value) })}>
                <option value="1">{t('transactions.inCash')}</option>
                {Array.from({ length: 47 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {hidden
                      ? t('transactions.installmentsHidden', { count: n })
                      : t('transactions.installmentsOption', {
                          count: n, amount: formatMoney(splitInstallments(form.amount, n)[0], card.currency, locale),
                        })}
                  </option>
                ))}
              </SelectField>
              {form.date && (
                <p className="text-[13px] font-medium text-muted">
                  {t('transactions.firstInvoice', { month: formatMonth(invoiceMonthFor(form.date, card.closing_day), locale) })}
                </p>
              )}
            </div>
          )}

          <TextField label={t('transactions.description')} maxLength={140} placeholder={t('transactions.descriptionPlaceholder')}
            value={form.description} onChange={(e) => set({ description: e.target.value })} />

          {saveError && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{saveError === 'locked' ? t('transactions.paidLocked') : t('common.errorGeneric')}</p>}

          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-2 rounded-b-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3
            sm:static sm:mx-0 sm:mb-0 sm:flex-row-reverse sm:rounded-none sm:p-0">
            <Button type="submit" className="sm:flex-1" full loading={create.isPending || update.isPending} disabled={remove.isPending}>{t('transactions.save')}</Button>
            {id && (
              <Button type="button" variant="danger" className="sm:flex-1" full loading={remove.isPending} disabled={create.isPending || update.isPending} onClick={() => void onDelete()}>
                {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
              </Button>
            )}
          </div>
        </section>
      </div>
    </form>
  )
}
