import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { ChoiceTile } from '../../components/ui/Chip'
import { CategoryIcon } from '../../components/CategoryIcon'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, MAX_AMOUNT_CENTS, parseAmount } from '../../lib/amount'
import { isRpcHint } from '../../lib/db-errors'
import { normalizeLocale } from '../../lib/locale'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import type { Category } from '../categories/types'
import { categoryLabel } from '../categories/label'
import { useCreateBudget, useDeleteBudget, useUpdateBudget } from './api'
import type { Budget } from './types'

type Common = {
  /** Orçamento em edição; sem ele, cria um novo. */
  budget?: Budget
  /** Orçamentos já existentes (do mesmo dono), para esconder as categorias que já têm limite. */
  existing: Budget[]
  categories: Category[]
  onDone: () => void
}

/** Pessoal: `currency` é só a moeda inicial. Grupo: só categorias padrão e moeda fixa (a do grupo). */
type Props = Common & ({ mode: 'personal'; currency: CurrencyCode } | { mode: 'group'; groupId: string; currency: CurrencyCode })

function errorKey(e: unknown): string {
  if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23505') return 'budgets.duplicate'
  if (isRpcHint(e, 'budget_category')) return 'budgets.categoryInvalid'
  if (isRpcHint(e, 'budget_system_category')) return 'budgets.systemOnly'
  return 'common.errorGeneric'
}

export function BudgetForm(props: Props) {
  const { mode, currency: initialCurrency, budget, existing, categories, onDone } = props
  const groupId = props.mode === 'group' ? props.groupId : null
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const create = useCreateBudget()
  const update = useUpdateBudget()
  const remove = useDeleteBudget()
  const [currency, setCurrency] = useState<CurrencyCode>(budget?.currency ?? initialCurrency)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [amountText, setAmountText] = useState(budget ? formatAmountPlain(budget.amount, locale) : '')
  const [amountError, setAmountError] = useState<string>()
  const [categoryError, setCategoryError] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const busy = create.isPending || update.isPending || remove.isPending

  const taken = new Set(existing.filter((b) => b.currency === currency && b.id !== budget?.id).map((b) => b.category_id))
  const selectable = categories.filter((c) =>
    c.kind === 'expense' && !c.archived && (mode === 'personal' || c.user_id === null) && !taken.has(c.id))
  const selected = categoryId && selectable.some((c) => c.id === categoryId) ? categoryId : null
  const editingCategory = budget ? categories.find((c) => c.id === budget.category_id) : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setConfirmDelete(false)
    const cents = parseAmount(amountText)
    const amountBad = cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS
    const categoryBad = !budget && !selected
    setAmountError(amountBad ? t('budgets.invalidAmount') : undefined)
    setCategoryError(categoryBad ? t('budgets.categoryInvalid') : undefined)
    if (cents === null || amountBad || categoryBad) return
    try {
      if (budget) await update.mutateAsync({ id: budget.id, amount: cents })
      else {
        await create.mutateAsync({
          category_id: selected!, amount: cents, currency, group_id: groupId,
        })
      }
      onDone()
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }

  async function destroy() {
    if (!budget || busy) return
    setError(null)
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(budget.id)
      onDone()
    } catch {
      setConfirmDelete(false)
      setError(t('common.errorGeneric'))
    }
  }

  const currencyPill = (
    <span className="self-start rounded-full bg-bg px-2.5 py-1 text-[12px] font-extrabold text-muted">{currency}</span>
  )

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      {budget ? (
        <div className="flex items-center gap-3.5 rounded-[20px] bg-surface px-3.5 py-3">
          {editingCategory && <CategoryIcon icon={editingCategory.icon} color={editingCategory.color} size="sm" />}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-muted">{t('budgets.category')}</span>
            <span className="block truncate text-[15px] font-bold">{editingCategory ? categoryLabel(editingCategory, t) : '—'}</span>
          </span>
          {currencyPill}
        </div>
      ) : (
        <>
          {mode === 'group' ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-muted">{t('budgets.currency')}</span>
              {currencyPill}
            </div>
          ) : (
            <SelectField label={t('budgets.currency')} value={currency} disabled={busy}
              onChange={(e) => { setCurrency(e.target.value as CurrencyCode); setError(null) }}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {currencyName(c, locale)}</option>)}
            </SelectField>
          )}
          <fieldset>
            <legend className="mb-3 text-[13px] font-semibold text-muted">{t('budgets.category')}</legend>
            {selectable.length === 0 ? (
              <p className="rounded-[18px] bg-surface px-4 py-3 text-sm font-medium text-muted">{t('budgets.allBudgeted')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {selectable.map((c) => (
                  <ChoiceTile key={c.id} name="budget-category" value={c.id} checked={selected === c.id} onChange={() => { setCategoryId(c.id); setCategoryError(undefined) }}>
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="line-clamp-2 text-[12px] font-bold leading-tight">{categoryLabel(c, t)}</span>
                  </ChoiceTile>
                ))}
              </div>
            )}
            {categoryError && <p className="mt-2 text-[13px] font-medium text-danger">{categoryError}</p>}
          </fieldset>
        </>
      )}

      <TextField label={t('budgets.amount')} inputMode="decimal" placeholder={formatAmountPlain(0, locale)}
        value={amountText} error={amountError}
        onChange={(e) => { setAmountText(e.target.value); setAmountError(undefined) }} />

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full loading={create.isPending || update.isPending} disabled={busy}>{t('budgets.save')}</Button>
      {budget && (
        <div className="flex flex-col gap-2">
          {confirmDelete && <p className="text-center text-[13px] font-medium text-muted">{t('budgets.deleteConfirm')}</p>}
          <Button type="button" variant="danger" full loading={remove.isPending} disabled={busy} onClick={() => void destroy()}>
            {confirmDelete ? t('common.confirmDelete') : t('budgets.delete')}
          </Button>
        </div>
      )}
    </form>
  )
}
