import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ReceiptText, Search } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { formatDay, isMonth, monthOf, relativeDay, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useAccounts } from '../accounts/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useTransactions } from './api'
import { filterTransactions, groupByDate, summarizeByCurrency, type TransactionFilters } from './filters'
import { TransactionRow } from './TransactionRow'
import type { TransactionKind } from './types'

const selectClass = 'h-11 min-w-0 rounded-xl border border-line bg-surface px-3 text-base text-fg outline-none focus:border-primary'

export default function TransactionsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const month = isMonth(raw) ? raw : monthOf(todayISO())
  const { data: transactions, isPending, isError, refetch } = useTransactions(month)
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const [filters, setFilters] = useState<TransactionFilters>({})

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const today = todayISO()
  const visible = filterTransactions(transactions ?? [], filters, (id) => {
    const c = categoriesById.get(id)
    return c ? categoryLabel(c, t) : ''
  })
  const groups = groupByDate(visible)
  const summary = summarizeByCurrency(visible)
  const hasFilters = !!(filters.kind || filters.accountId || filters.categoryId || filters.search)

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('transactions.title')}</h1>
      <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />

      {summary.map((s) => (
        <dl key={s.currency} className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
          <div><dt className="text-xs text-muted">{t('transactions.income_total')}</dt>
            <dd className="font-semibold tabular-nums text-success">{formatMoney(s.income, s.currency, locale)}</dd></div>
          <div><dt className="text-xs text-muted">{t('transactions.expense_total')}</dt>
            <dd className="font-semibold tabular-nums text-danger">{formatMoney(s.expense, s.currency, locale)}</dd></div>
          <div><dt className="text-xs text-muted">{t('transactions.net_total')}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(s.net, s.currency, locale)}</dd></div>
        </dl>
      ))}

      <div className="flex flex-col gap-2">
        <label className="relative">
          <span className="sr-only">{t('transactions.search')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={filters.search ?? ''} placeholder={t('transactions.searchPlaceholder')}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-base outline-none focus:border-primary" />
        </label>
        <SegmentedControl<'all' | TransactionKind> label={t('transactions.title')} value={filters.kind ?? 'all'}
          onChange={(v) => setFilters({ ...filters, kind: v === 'all' ? undefined : v })}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'expense', label: t('transactions.expense') },
            { value: 'income', label: t('transactions.income') },
          ]} />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label={t('transactions.account')} className={selectClass} value={filters.accountId ?? ''}
            onChange={(e) => setFilters({ ...filters, accountId: e.target.value || undefined })}>
            <option value="">{t('transactions.allAccounts')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label={t('transactions.category')} className={selectClass} value={filters.categoryId ?? ''}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || undefined })}>
            <option value="">{t('transactions.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c, t)}</option>)}
          </select>
        </div>
      </div>

      {isPending ? (
        <FullScreenSpinner />
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon={ReceiptText}
          title={hasFilters ? t('transactions.noResults') : t('transactions.empty')}
          description={hasFilters ? undefined : t('transactions.emptyBody')}
          action={hasFilters ? undefined : <Link to="/new" className="font-semibold text-primary">{t('transactions.new')}</Link>} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const rel = relativeDay(g.date, today)
            return (
              <section key={g.date} aria-label={formatDay(g.date, locale)}>
                <h2 className="px-3 pb-1 text-sm font-semibold capitalize text-muted">
                  {rel ? t(`transactions.${rel}`) : formatDay(g.date, locale)}
                </h2>
                <ul className="rounded-2xl border border-line bg-surface p-1">
                  {g.items.map((tx) => (
                    <li key={tx.id}>
                      <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                        account={accountsById.get(tx.account_id)} locale={locale} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
