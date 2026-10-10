import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Wallet } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useAccounts } from '../accounts/api'
import { balancesByCurrency } from '../accounts/totals'
import { useCategories } from '../categories/api'
import { useProfile } from '../profile/api'
import { useRecentTransactions, useTransactions } from '../transactions/api'
import { summarizeByCurrency } from '../transactions/filters'
import { TransactionRow } from '../transactions/TransactionRow'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const { data: profile } = useProfile()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const categories = categoriesQuery.data ?? []
  const month = monthOf(todayISO())
  const monthQuery = useTransactions(month)
  const recentQuery = useRecentTransactions()
  const monthTx = monthQuery.data ?? []
  const recent = recentQuery.data ?? []

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map((accountsQuery.data ?? []).map((a) => [a.id, a])), [accountsQuery.data])

  if (accountsQuery.isPending) return <div className="min-h-[40vh]"><FullScreenSpinner /></div>
  if (accountsQuery.isError) return <QueryError onRetry={() => void accountsQuery.refetch()} />

  const accounts = accountsQuery.data
  const balances = balancesByCurrency(accounts)
  const summary = summarizeByCurrency(monthTx)
  const greeting = profile?.name ? t('home.greeting', { name: profile.name.split(' ')[0] }) : t('home.greetingNoName')

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      {profile ? <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1> : <div className="h-8" />}

      {accounts.filter((a) => !a.archived).length === 0 ? (
        <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
          action={<Link to="/accounts" className="font-semibold text-primary">{t('accounts.new')}</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Link to="/accounts" className="rounded-3xl bg-primary p-5 text-primary-fg shadow-sm">
            <p className="text-sm opacity-80">{t('home.balance')}</p>
            {balances.map((b) => (
              <p key={b.currency} className="text-3xl font-bold tabular-nums">{formatMoney(b.total, b.currency, locale)}</p>
            ))}
          </Link>
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{t('home.thisMonth')}</p>
            {monthQuery.isPending ? (
              <div className="grid place-items-center py-6"><Spinner /></div>
            ) : monthQuery.isError ? (
              <div className="mt-2"><QueryError onRetry={() => void monthQuery.refetch()} /></div>
            ) : summary.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t('transactions.empty')}</p>
            ) : (
              summary.map((s) => (
                <dl key={s.currency} className="mt-2 grid grid-cols-2 gap-2">
                  <div><dt className="text-xs text-muted">{t('transactions.income_total')}</dt>
                    <dd className="font-semibold tabular-nums text-success">{formatMoney(s.income, s.currency, locale)}</dd></div>
                  <div><dt className="text-xs text-muted">{t('transactions.expense_total')}</dt>
                    <dd className="font-semibold tabular-nums text-danger">{formatMoney(s.expense, s.currency, locale)}</dd></div>
                </dl>
              ))
            )}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('home.recent')}</h2>
          <Link to="/transactions" className="inline-flex items-center gap-1 py-2 text-sm font-medium text-primary">
            {t('home.seeAll')} <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {recentQuery.isPending || categoriesQuery.isPending ? (
          <div className="grid place-items-center py-6"><Spinner /></div>
        ) : recentQuery.isError || categoriesQuery.isError ? (
          <div className="mt-2">
            <QueryError onRetry={() => { void recentQuery.refetch(); void categoriesQuery.refetch() }} />
          </div>
        ) : recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('transactions.emptyBody')}</p>
        ) : (
          <ul className="mt-2 rounded-2xl border border-line bg-surface p-1">
            {recent.slice(0, 5).map((tx) => (
              <li key={tx.id}>
                <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                  account={accountsById.get(tx.account_id)} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
