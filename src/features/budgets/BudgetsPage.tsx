import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus, Target } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { Interpolate } from '../../components/Interpolate'
import { Button } from '../../components/ui/Button'
import { PageHeader, RowItem, RowList, SectionHeader } from '../../components/ui/Card'
import { HERO_NUMBER, HeroCard } from '../../components/ui/HeroCard'
import { Ring } from '../../components/ui/Ring'
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
import { BudgetRow } from './BudgetRow'
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

  const left = total.limit - total.spent
  const ringText = t('home.heroBudgetRing', { pct: budgetPct(total.spent, total.limit) })

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('budgets.title')} subtitle={t('budgets.subtitle')} action={budgets.length > 0 ? newButton : undefined} />

      {budgets.length === 0 ? (
        <EmptyState icon={Target} title={t('budgets.empty')} description={t('budgets.emptyBody')}
          action={<Button className="h-11" onClick={() => setEditing('new')}>{t('budgets.new')}</Button>} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-10">
            <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />
            {currencies.length > 1 && (
              <SegmentedControl label={t('budgets.currency')} value={currency} onChange={setPicked}
                options={currencies.map((c) => ({ value: c, label: c }))} />
            )}
            {monthQuery.isSuccess && (
              <HeroCard
                top={<>
                  <h2 className="text-[15px] font-semibold text-muted">{t('budgets.total')}</h2>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-extrabold text-muted">{currency}</span>
                </>}
                value={<Amount cents={Math.abs(left)} currency={currency} locale={locale} smallSymbol className={`${HERO_NUMBER} ${left < 0 ? 'text-danger' : ''}`} />}
                label={t(left < 0 ? 'budgets.heroOver' : 'budgets.heroLeft')}
                detail={
                  <p className="mt-1 text-[13px] font-medium text-muted">
                    <Interpolate i18nKey="budgets.spentOf" values={{
                      spent: <Amount cents={total.spent} currency={currency} locale={locale} className="font-bold text-fg" />,
                      limit: <Amount cents={total.limit} currency={currency} locale={locale} />,
                    }} />
                  </p>
                }
                caption={ringText}
                ring={
                  <Ring value={total.limit > 0 ? total.spent / total.limit : 0} size={100} stroke={10} color="var(--primary)"
                    overflowColor="var(--danger)" ariaLabel={ringText}>
                    <Target className="size-7 text-primary" aria-hidden="true" />
                  </Ring>
                } />
            )}
          </aside>

          <section aria-labelledby="budgets-list" className="min-w-0">
            <SectionHeader id="budgets-list" title={t('budgets.byCategory')} />
            {monthQuery.isPending ? (
              <div className="grid place-items-center py-8 text-primary"><Spinner /></div>
            ) : monthQuery.isError ? (
              <QueryError onRetry={() => void monthQuery.refetch()} />
            ) : (
              <RowList>
                {rows.map((r) => (
                  <RowItem key={r.budget.id}>
                    <BudgetRow flush category={categoriesById.get(r.budget.category_id)} spent={r.spent} limit={r.budget.amount}
                      currency={r.budget.currency} locale={locale} onClick={() => setEditing(r.budget)} />
                  </RowItem>
                ))}
              </RowList>
            )}
          </section>
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
