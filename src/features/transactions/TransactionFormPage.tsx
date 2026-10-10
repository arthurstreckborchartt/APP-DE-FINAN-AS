import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { AmountKeypad } from '../../components/ui/AmountKeypad'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/SelectField'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { CategoryIcon } from '../../components/CategoryIcon'
import { monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAccounts } from '../accounts/api'
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
  date: string
  description: string
}

type Errors = Partial<Record<'amount' | 'category' | 'account' | 'date', string>>

export default function TransactionFormPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const accountsQuery = useAccounts()
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
  const [saveError, setSaveError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const accounts = accountsQuery.data
  const categories = categoriesQuery.data
  const existing = existingQuery.data

  const base = useMemo<Draft | null>(() => {
    if (!accounts || !categories) return null
    if (id) {
      if (!existing) return null
      return {
        kind: existing.kind, amount: existing.amount, categoryId: existing.category_id,
        accountId: existing.account_id, date: existing.date, description: existing.description,
      }
    }
    if (!recentSettled) return null
    const activeAccounts = accounts.filter((a) => !a.archived).map((a) => a.id)
    const activeCats = categories.filter((c) => !c.archived && c.kind === 'expense').map((c) => c.id)
    const d = pickDefaults(recent, 'expense', activeAccounts, activeCats)
    return { kind: 'expense', amount: 0, categoryId: d.categoryId, accountId: d.accountId, date: todayISO(), description: '' }
  }, [id, existing, accounts, categories, recent, recentSettled])

  if (remove.isPending || remove.isSuccess) return <FullScreenSpinner />
  if (accountsQuery.isError || categoriesQuery.isError || existingQuery.isError) {
    return <QueryError onRetry={() => {
      void accountsQuery.refetch()
      void categoriesQuery.refetch()
      if (id) void existingQuery.refetch()
    }} />
  }
  if (!base || !accounts || !categories) return <FullScreenSpinner />

  const form = draft ?? base
  const selectableAccounts = accounts.filter((a) => !a.archived || a.id === form.accountId)
  if (selectableAccounts.length === 0) {
    return (
      <EmptyState icon={Wallet} title={t('transactions.noAccounts')}
        action={<Link to="/accounts" className="font-semibold text-primary">{t('transactions.goToAccounts')}</Link>} />
    )
  }

  const selectableCategories = categories.filter(
    (c) => c.kind === form.kind && (!c.archived || c.id === form.categoryId),
  )
  const account = accounts.find((a) => a.id === form.accountId)
  const currency = account?.currency ?? profile?.currency ?? 'BRL'

  function set(patch: Partial<Draft>) {
    setDraft({ ...form, ...patch })
    setSaveError(false)
    setErrors({})
    setConfirmDelete(false)
  }

  function changeKind(kind: TransactionKind) {
    if (kind === form.kind) return
    const activeCats = categories!.filter((c) => !c.archived && c.kind === kind).map((c) => c.id)
    const activeAccounts = accounts!.filter((a) => !a.archived).map((a) => a.id)
    const d = pickDefaults(recent, kind, activeAccounts, activeCats)
    set({ kind, categoryId: d.categoryId })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (form.amount <= 0) next.amount = t('transactions.errors.amount')
    if (!form.categoryId) next.category = t('transactions.errors.category')
    if (!form.date) next.date = t('transactions.errors.date')
    if (!form.accountId) next.account = t('transactions.errors.account')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input = {
      kind: form.kind, amount: form.amount, date: form.date, category_id: form.categoryId!,
      description: form.description.trim(), account_id: form.accountId!,
    }
    try {
      if (id) await update.mutateAsync({ id, input })
      else await create.mutateAsync(input)
      navigate(`/transactions?m=${monthOf(form.date)}`, { replace: true })
    } catch {
      setSaveError(true)
    }
  }

  async function onDelete() {
    if (!id) return
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(id)
      navigate(`/transactions?m=${monthOf(form.date)}`, { replace: true })
    } catch {
      setConfirmDelete(false)
      setSaveError(true)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{id ? t('transactions.edit') : t('transactions.new')}</h1>

      <SegmentedControl label={t('transactions.title')} value={form.kind} onChange={changeKind}
        options={[
          { value: 'expense', label: t('transactions.expense') },
          { value: 'income', label: t('transactions.income') },
        ]} />

      <AmountKeypad value={form.amount} onChange={(amount) => set({ amount })} currency={currency} locale={locale}
        label={t('transactions.amount')} error={errors.amount} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('transactions.category')}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {selectableCategories.map((c) => (
            <label key={c.id} className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-2 text-center
              has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-2 has-focus-visible:ring-primary">
              <input type="radio" name="category" className="sr-only" value={c.id} checked={form.categoryId === c.id}
                onChange={() => set({ categoryId: c.id })} />
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="line-clamp-2 text-xs font-medium">{categoryLabel(c, t)}</span>
            </label>
          ))}
        </div>
        {errors.category && <p className="mt-1 text-sm text-danger">{errors.category}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SelectField label={t('transactions.account')} value={form.accountId ?? ''}
            onChange={(e) => set({ accountId: e.target.value || null })}>
            <option value="" disabled>—</option>
            {selectableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </SelectField>
          {errors.account && <p className="mt-1 text-sm text-danger">{errors.account}</p>}
        </div>
        <TextField label={t('transactions.date')} type="date" value={form.date}
          onChange={(e) => set({ date: e.target.value })} error={errors.date} />
      </div>

      <TextField label={t('transactions.description')} maxLength={140} placeholder={t('transactions.descriptionPlaceholder')}
        value={form.description} onChange={(e) => set({ description: e.target.value })} />

      {saveError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t('common.errorGeneric')}</p>}

      <Button type="submit" full loading={create.isPending || update.isPending} disabled={remove.isPending}>{t('transactions.save')}</Button>
      {id && (
        <Button type="button" variant="danger" full loading={remove.isPending} disabled={create.isPending || update.isPending} onClick={() => void onDelete()}>
          {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
        </Button>
      )}
    </form>
  )
}
