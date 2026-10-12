import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ReceiptText, Search } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { formatDay, isMonth, monthOf, relativeDay, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAccounts } from '../accounts/api'
import { useCards } from '../cards/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useTransactions } from './api'
import { filterTransactions, groupByDate, summarizeByCurrency, type TransactionFilters } from './filters'
import { TransactionRow } from './TransactionRow'
import type { TransactionKind } from './types'

const fieldClass = 'h-12 min-w-0 appearance-none rounded-2xl border border-transparent bg-surface-2 text-[15px] font-semibold text-fg outline-none transition placeholder:font-medium placeholder:text-muted hover:bg-surface-3 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/15'

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
  const hasFilters = !!(filters.kind || filters.accountId || filters.cardId || filters.categoryId || filters.search)

  const filtersPanel = (
    <div className="flex flex-col gap-3">
      <label className="relative">
        <span className="sr-only">{t('transactions.search')}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" value={filters.search ?? ''} placeholder={t('transactions.searchPlaceholder')}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className={`${fieldClass} w-full pl-12 pr-4`} />
      </label>
      <SegmentedControl<'all' | TransactionKind> label={t('transactions.kindFilter')} value={filters.kind ?? 'all'}
        onChange={(v) => setFilters({ ...filters, kind: v === 'all' ? undefined : v })}
        options={[
          { value: 'all', label: t('common.all') },
          { value: 'expense', label: t('transactions.expense') },
          { value: 'income', label: t('transactions.income') },
        ]} />
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
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('transactions.title')}</h1>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-10 lg:order-2">
          <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />
          {summary.map((s) => (
            <dl key={s.currency} className="grid grid-cols-3 gap-3 rounded-[24px] bg-surface p-5 shadow-sheet lg:grid-cols-1 lg:gap-4">
              {summary.length > 1 && (
                <span className="col-span-3 self-start justify-self-start rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-extrabold text-muted lg:col-span-1">
                  {s.currency}
                </span>
              )}
              {([
                ['income_total', s.income, 'income', 'text-success'],
                ['expense_total', s.expense, 'expense', 'text-fg'],
                ['net_total', Math.abs(s.net), s.net >= 0 ? 'income' : 'expense', s.net >= 0 ? 'text-success' : 'text-danger'],
              ] as const).map(([key, value, sign, tone]) => (
                <div key={key} className="min-w-0 lg:flex lg:items-baseline lg:justify-between lg:gap-3">
                  <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{t(`transactions.${key}`)}</dt>
                  <dd className="mt-1 lg:mt-0">
                    <Amount cents={value} currency={s.currency} locale={locale} sign={key === 'net_total' ? sign : undefined}
                      className={`block break-words text-[15px] font-extrabold sm:text-[17px] ${tone}`} />
                  </dd>
                </div>
              ))}
            </dl>
          ))}
          <div className="rounded-[24px] bg-surface p-4 shadow-sheet">{filtersPanel}</div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5 lg:order-1">
          {refsError && (
            <QueryError onRetry={() => { void accountsQuery.refetch(); void categoriesQuery.refetch() }} />
          )}
          {isPending ? (
            <div className="min-h-[40vh]"><FullScreenSpinner /></div>
          ) : isError ? (
            <QueryError onRetry={() => void refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState icon={ReceiptText}
              title={hasFilters ? t('transactions.noResults') : t('transactions.empty')}
              description={hasFilters ? undefined : t('transactions.emptyBody')}
              action={hasFilters ? undefined : (
                <Link to="/new" className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-fg">{t('transactions.new')}</Link>
              )} />
          ) : (
            groups.map((g) => {
              const rel = relativeDay(g.date, today)
              const dayTotals = summarizeByCurrency(g.items)
              return (
                <section key={g.date} aria-label={formatDay(g.date, locale)} className="rounded-[24px] bg-surface p-2 shadow-sheet sm:p-3">
                  <header className="flex items-baseline justify-between gap-3 px-3 pb-1 pt-2">
                    <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">
                      {rel ? t(`transactions.${rel}`) : formatDay(g.date, locale)}
                    </h2>
                    <span className="flex flex-col items-end">
                      {dayTotals.map((d) => (
                        <Amount key={d.currency} cents={Math.abs(d.net)} currency={d.currency} locale={locale}
                          sign={d.net >= 0 ? 'income' : 'expense'} className="text-[13px] font-bold text-muted" />
                      ))}
                    </span>
                  </header>
                  <ul className="flex flex-col">
                    {g.items.map((tx) => (
                      <li key={tx.entry_id}>
                        <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                          account={tx.account_id ? accountsById.get(tx.account_id) : undefined}
                          card={tx.card_id ? cardsById.get(tx.card_id) : undefined} locale={locale} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
