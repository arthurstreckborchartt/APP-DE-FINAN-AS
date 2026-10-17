import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ReceiptText, Search, SlidersHorizontal } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { dayLabels, MoneyLineChart } from '../../components/MoneyLineChart'
import { Card, PageHeader, RowItem, RowList, SectionHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { formatDay, isMonth, monthOf, relativeDay, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAccounts } from '../accounts/api'
import { useCards } from '../cards/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useTransactions } from './api'
import { filterTransactions, groupByDate, summarizeByCurrency, type TransactionFilters } from './filters'
import { dailyExpenses, daysInMonth } from './series'
import { TransactionRow } from './TransactionRow'
import type { TransactionKind } from './types'

const fieldClass = 'field h-12 min-w-0 appearance-none rounded-[18px] text-[15px] font-semibold text-fg outline-none transition placeholder:font-medium placeholder:text-muted hover:bg-surface-2 focus:ring-2 focus:ring-primary dark:bg-surface-2 dark:hover:bg-surface-3'

export default function TransactionsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const month = isMonth(raw) ? raw : monthOf(todayISO())
  const { data: transactions, isPending, isError, refetch } = useTransactions(month)
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const cardsQuery = useCards()
  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const cards = cardsQuery.data ?? []
  const refsError = accountsQuery.isError || categoriesQuery.isError || cardsQuery.isError
  const [filters, setFilters] = useState<TransactionFilters>(() => ({ categoryId: params.get('c') || undefined }))
  const [filtersOpen, setFiltersOpen] = useState(false)

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const today = todayISO()
  const visible = filterTransactions(transactions ?? [], filters, (id) => {
    const c = categoriesById.get(id)
    return c ? categoryLabel(c, t) : ''
  })
  const groups = groupByDate(visible)
  const summary = summarizeByCurrency(visible)
  // Gastos por dia do mês escolhido (respeita os filtros); no mês atual, só até hoje.
  const chartCurrency = summary.find((s) => s.expense > 0)?.currency
  const lastDay = month === monthOf(todayISO()) ? Number(todayISO().slice(8, 10)) : daysInMonth(month)
  const dailySeries = chartCurrency ? dailyExpenses(visible, month, chartCurrency).slice(0, lastDay) : []
  const hasFilters = !!(filters.kind || filters.accountId || filters.cardId || filters.categoryId || filters.search)

  const activeFilters = (filters.accountId || filters.cardId ? 1 : 0) + (filters.categoryId ? 1 : 0)

  const searchField = (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{t('transactions.search')}</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input type="search" value={filters.search ?? ''} placeholder={t('transactions.searchPlaceholder')}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        className={`${fieldClass} w-full pl-12 pr-4`} />
    </label>
  )
  const kindControl = (
    <SegmentedControl<'all' | TransactionKind> label={t('transactions.kindFilter')} value={filters.kind ?? 'all'}
      onChange={(v) => setFilters({ ...filters, kind: v === 'all' ? undefined : v })}
      options={[
        { value: 'all', label: t('common.all') },
        { value: 'expense', label: t('transactions.expense') },
        { value: 'income', label: t('transactions.income') },
      ]} />
  )
  const selects = (
    <div className="grid grid-cols-1 gap-2">
      <div className="relative min-w-0">
        <select aria-label={t('transactions.account')} className={`${fieldClass} w-full pl-4 pr-10`} value={filters.accountId ? `a:${filters.accountId}` : filters.cardId ? `c:${filters.cardId}` : ''}
          onChange={(e) => {
            const v = e.target.value
            setFilters({
              ...filters,
              accountId: v.startsWith('a:') ? v.slice(2) : undefined,
              cardId: v.startsWith('c:') ? v.slice(2) : undefined,
            })
          }}>
          <option value="">{t('transactions.allAccounts')}</option>
          <optgroup label={t('transactions.sourceAccount')}>
            {accounts.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
          </optgroup>
          {cards.length > 0 && (
            <optgroup label={t('transactions.sourceCard')}>
              {cards.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}
            </optgroup>
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
      <div className="relative min-w-0">
        <select aria-label={t('transactions.category')} className={`${fieldClass} w-full pl-4 pr-10`} value={filters.categoryId ?? ''}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || undefined })}>
          <option value="">{t('transactions.allCategories')}</option>
          {(['expense', 'income'] as const).map((kind) => (
            <optgroup key={kind} label={t(`categories.${kind}`)}>
              {categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{categoryLabel(c, t)}</option>)}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('transactions.title')} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-10 lg:order-2 lg:gap-4">
          <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />

          {/* Celular: busca e tipo à vista; conta e categoria num botão "Filtros". */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              {searchField}
              <button type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog"
                className={`relative inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                  ${activeFilters > 0 ? 'bg-ink text-ink-fg hover:bg-ink-hover' : 'bg-surface text-fg hover:bg-surface-2'}`}>
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {t('transactions.filters')}
                {activeFilters > 0 && (
                  <span className="num grid size-5 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-fg">
                    {activeFilters}
                    <span className="sr-only"> {t('transactions.filtersActive', { count: activeFilters })}</span>
                  </span>
                )}
              </button>
            </div>
            {kindControl}
          </div>

          {summary.length > 0 && (
          <div className="rounded-card bg-surface px-4 py-3 sm:px-5 lg:py-5">
            {summary.map((s) => (
              <dl key={s.currency} className="grid grid-cols-3 gap-3 border-surface-3/60 py-2 not-first:border-t lg:grid-cols-1 lg:gap-3 lg:py-3 lg:first:pt-0 lg:last:pb-0">
                {summary.length > 1 && (
                  <span className="col-span-3 self-start justify-self-start rounded-full bg-bg px-2.5 py-0.5 text-[12px] font-extrabold text-muted dark:bg-surface-2 lg:col-span-1">
                    {s.currency}
                  </span>
                )}
                {([
                  ['income_total', s.income, 'income', 'text-success'],
                  ['expense_total', s.expense, 'expense', 'text-fg'],
                  ['net_total', Math.abs(s.net), s.net >= 0 ? 'income' : 'expense', s.net >= 0 ? 'text-success' : 'text-danger'],
                ] as const).map(([key, value, sign, tone]) => (
                  <div key={key} className="min-w-0 lg:flex lg:items-baseline lg:justify-between lg:gap-3">
                    <dt className="text-[12px] font-semibold text-muted lg:text-[13px]">{t(`transactions.${key}`)}</dt>
                    <dd className="lg:mt-0">
                      <Amount cents={value} currency={s.currency} locale={locale} sign={key === 'net_total' ? sign : undefined}
                        className={`block break-words text-[15px] font-extrabold tracking-[-0.02em] sm:text-[19px] ${tone}`} />
                    </dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
          )}

          <div className="hidden flex-col gap-3 rounded-card bg-surface p-4 lg:flex">
            {searchField}
            {kindControl}
            {selects}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {refsError && (
            <QueryError onRetry={() => { void accountsQuery.refetch(); void categoriesQuery.refetch(); void cardsQuery.refetch() }} />
          )}
          {!isPending && dailySeries.length > 1 && (
            <Card className="max-lg:order-2">
              <SectionHeader title={t('transactions.dailySpending')} />
              <MoneyLineChart values={dailySeries} labels={dayLabels(month, lastDay, locale)} currency={chartCurrency!}
                locale={locale} name={t('transactions.dailySpending')} />
            </Card>
          )}
          <div className="flex min-w-0 flex-col gap-6 max-lg:order-1">
          {isPending ? (
            <div className="min-h-[40vh]"><FullScreenSpinner /></div>
          ) : isError ? (
            <QueryError onRetry={() => void refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState icon={ReceiptText}
              title={hasFilters ? t('transactions.noResults') : t('transactions.empty')}
              description={hasFilters ? undefined : t('transactions.emptyBody')}
              action={hasFilters ? undefined : (
                <Link to="/new" className="mt-1 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-ink-fg hover:bg-ink-hover">{t('transactions.new')}</Link>
              )} />
          ) : (
            groups.map((g) => {
              const rel = relativeDay(g.date, today)
              const dayTotals = summarizeByCurrency(g.items)
              return (
                <section key={g.date} aria-label={formatDay(g.date, locale)}>
                  <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <h2 className="text-[15px] font-extrabold tracking-[-0.01em] first-letter:uppercase">
                      {rel ? t(`transactions.${rel}`) : formatDay(g.date, locale)}
                    </h2>
                    <span className="flex flex-col items-end">
                      {dayTotals.map((d) => (
                        <Amount key={d.currency} cents={Math.abs(d.net)} currency={d.currency} locale={locale}
                          sign={d.net >= 0 ? 'income' : 'expense'} className="text-[13px] font-bold text-muted" />
                      ))}
                    </span>
                  </header>
                  <RowList>
                    {g.items.map((tx) => (
                      <RowItem key={tx.entry_id}>
                        <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                          account={tx.account_id ? accountsById.get(tx.account_id) : undefined}
                          card={tx.card_id ? cardsById.get(tx.card_id) : undefined} locale={locale} />
                      </RowItem>
                    ))}
                  </RowList>
                </section>
              )
            })
          )}
          </div>
        </div>
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('transactions.filters')}>
        <div className="flex flex-col gap-4">
          {selects}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" disabled={activeFilters === 0}
              onClick={() => setFilters({ ...filters, accountId: undefined, cardId: undefined, categoryId: undefined })}>
              {t('transactions.clearFilters')}
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>{t('transactions.showResults')}</Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
