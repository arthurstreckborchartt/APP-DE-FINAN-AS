import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus, Target } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { Interpolate } from '../../components/Interpolate'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { budgetPct } from '../../lib/budget'
import { isMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import type { CurrencyCode } from '../../lib/money'
import { useCategories } from '../categories/api'
import { useProfile } from '../profile/api'
import { useTransactions } from '../transactions/api'
import { useBudgets } from './api'
import { BudgetForm } from './BudgetForm'
import { BudgetBar, BudgetRow } from './BudgetRow'
import { budgetsWithSpent, budgetTotals } from './rows'
import type { Budget } from './types'

export default function BudgetsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const month = isMonth(raw) ? raw : monthOf(todayISO())
  const { data: profile } = useProfile()
  const budgetsQuery = useBudgets()
  const categoriesQuery = useCategories()
  const monthQuery = useTransactions(month)
  const [picked, setPicked] = useState<string | null>(null)
  const [editing, setEditing] = useState<Budget | 'new' | null>(null)

  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data])
  const categoriesById = useMemo(() => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])), [categoriesQuery.data])
  // Moedas com orçamento: a do perfil primeiro.
  const currencies = useMemo(() => {
    const set = [...new Set(budgets.map((b) => b.currency))].sort()
    return set.sort((a, b) => Number(b === profile?.currency) - Number(a === profile?.currency))
  }, [budgets, profile?.currency])
  // Sem orçamentos a lista fica vazia e a moeda não é usada.
  const currency: string = picked && currencies.includes(picked as CurrencyCode) ? picked : currencies[0] ?? ''

  if (budgetsQuery.isPending || categoriesQuery.isPending) return <FullScreenSpinner />
  if (budgetsQuery.isError || categoriesQuery.isError) {
    return <QueryError onRetry={() => { void budgetsQuery.refetch(); void categoriesQuery.refetch() }} />
  }

  const rows = budgetsWithSpent(budgets, monthQuery.data ?? [], currency)
  const total = budgetTotals(rows)
  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-5" aria-hidden="true" /> {t('budgets.new')}
    </Button>
  )

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('budgets.title')}</h1>
          <p className="mt-1 text-[15px] font-medium text-muted">{t('budgets.subtitle')}</p>
        </div>
        {budgets.length > 0 && newButton}
      </div>

      {budgets.length === 0 ? (
        <EmptyState icon={Target} title={t('budgets.empty')} description={t('budgets.emptyBody')}
          action={<Button className="h-10" onClick={() => setEditing('new')}>{t('budgets.new')}</Button>} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-10 lg:order-2">
            <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />
            {currencies.length > 1 && (
              <SegmentedControl label={t('budgets.currency')} value={currency} onChange={setPicked}
                options={currencies.map((c) => ({ value: c, label: c }))} />
            )}
            {monthQuery.isSuccess && (
              <div className="rounded-[24px] bg-surface p-5 shadow-sheet">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">{t('budgets.total')}</h2>
                  <span className="num text-[15px] font-extrabold">{t('budgets.pct', { pct: budgetPct(total.spent, total.limit) })}</span>
                </div>
                <p className="mt-2 text-[15px] font-medium text-muted">
                  <Interpolate i18nKey="budgets.spentOf" values={{
                    spent: <Amount cents={total.spent} currency={currency} locale={locale} className="text-[22px] font-extrabold tracking-[-0.02em] text-fg" />,
                    limit: <Amount cents={total.limit} currency={currency} locale={locale} className="font-bold" />,
                  }} />
                </p>
                <BudgetBar spent={total.spent} limit={total.limit} label={t('budgets.total')} className="mt-3" />
              </div>
            )}
          </aside>

          <div className="rounded-[24px] bg-surface p-5 shadow-sheet sm:p-6 lg:order-1">
            {monthQuery.isPending ? (
              <div className="grid place-items-center py-8 text-primary"><Spinner /></div>
            ) : monthQuery.isError ? (
              <QueryError onRetry={() => void monthQuery.refetch()} />
            ) : (
              <ul className="flex flex-col gap-1">
                {rows.map((r) => (
                  <li key={r.budget.id}>
                    <BudgetRow category={categoriesById.get(r.budget.category_id)} spent={r.spent} limit={r.budget.amount}
                      currency={r.budget.currency} locale={locale} onClick={() => setEditing(r.budget)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? t('budgets.new') : t('budgets.edit')}>
        {editing && (
          <BudgetForm key={editing === 'new' ? 'new' : editing.id} mode="personal"
            currency={(currency || profile?.currency || 'BRL') as CurrencyCode}
            budget={editing === 'new' ? undefined : editing} existing={budgets}
            categories={categoriesQuery.data} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </section>
  )
}
