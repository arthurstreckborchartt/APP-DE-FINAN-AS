import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, Landmark, Plus, ReceiptText, Tags, Wallet } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { formatMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { setHideValues, useHideValues } from '../../lib/privacy'
import { useAccounts } from '../accounts/api'
import { balancesByCurrency } from '../accounts/totals'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useProfile } from '../profile/api'
import { useRecentTransactions, useTransactions } from '../transactions/api'
import { expensesByCategory, summarizeByCurrency } from '../transactions/filters'
import { TransactionRow } from '../transactions/TransactionRow'

const TOP_CATEGORIES = 5

function Sheet({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] bg-surface p-5 shadow-sheet sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Loading() {
  return <div className="grid place-items-center py-8 text-primary"><Spinner /></div>
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const hidden = useHideValues()
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
  const activeAccounts = accounts.filter((a) => !a.archived)
  const balances = balancesByCurrency(accounts)
  const summary = summarizeByCurrency(monthTx)
  const breakdownCurrency =
    summary.find((s) => s.currency === profile?.currency && s.expense > 0)?.currency ??
    summary.find((s) => s.expense > 0)?.currency
  const breakdown = breakdownCurrency ? expensesByCategory(monthTx, breakdownCurrency) : []
  const top = breakdown.slice(0, TOP_CATEGORIES)
  const rest = breakdown.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.total, 0)
  const restShare = breakdown.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.share, 0)
  const firstName = profile?.name?.trim().split(/\s+/)[0]

  const quick = [
    { to: '/new', label: t('nav.new'), icon: Plus, primary: true },
    { to: '/transactions', label: t('nav.transactions'), icon: ReceiptText },
    { to: '/accounts', label: t('accounts.title'), icon: Landmark },
    { to: '/categories', label: t('categories.title'), icon: Tags },
  ]

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {/* Painel de saldo */}
      <section className="brand-panel rise relative overflow-hidden rounded-[28px] p-6 shadow-float sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-brand-muted">
              {profile ? (firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')) : ' '}
            </p>
            <p className="mt-5 text-[13px] font-bold uppercase tracking-[0.08em] text-brand-muted">{t('home.balance')}</p>
          </div>
          <button type="button" onClick={() => setHideValues(!hidden)}
            aria-label={hidden ? t('home.showValues') : t('home.hideValues')} aria-pressed={hidden}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20 focus-visible:outline-white">
            {hidden ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
        {balances.length === 0 ? (
          <p className="num mt-1 text-[40px] font-extrabold leading-tight tracking-[-0.03em]">—</p>
        ) : (
          <div className="mt-1 flex flex-col gap-1">
            {balances.map((b, i) => (
              <Amount key={b.currency} cents={b.total} currency={b.currency} locale={locale}
                className={i === 0
                  ? 'text-[38px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[46px]'
                  : 'text-xl font-bold tracking-[-0.02em] text-brand-muted'} />
            ))}
          </div>
        )}
        <Link to="/accounts"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20">
          <Wallet className="size-4" aria-hidden="true" />
          {t('home.accounts', { count: activeAccounts.length })}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Atalhos */}
      <nav aria-label={t('home.quickActions')} className="rise rise-2 grid grid-cols-4 gap-2 sm:max-w-xl">
        {quick.map(({ to, label, icon: Icon, primary }) => (
          <Link key={to} to={to} className="group flex flex-col items-center gap-2 rounded-2xl py-1 text-center">
            <span className={`grid size-14 place-items-center rounded-full transition group-active:scale-95 ${
              primary ? 'bg-primary text-primary-fg shadow-float' : 'bg-surface text-primary shadow-sheet group-hover:bg-primary-soft'}`}>
              <Icon className="size-6" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="text-[12px] font-bold leading-tight text-fg">{label}</span>
          </Link>
        ))}
      </nav>

      {activeAccounts.length === 0 ? (
        <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
          action={<Link to="/accounts" className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-fg">{t('accounts.new')}</Link>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
          {/* Este mês */}
          <Sheet title={t('home.thisMonth')} className="rise rise-3"
            action={<span className="inline-block text-[13px] font-semibold text-muted first-letter:uppercase">{formatMonth(month, locale)}</span>}>
            {monthQuery.isPending ? <Loading /> : monthQuery.isError ? (
              <QueryError onRetry={() => void monthQuery.refetch()} />
            ) : summary.length === 0 ? (
              <p className="py-4 text-sm font-medium text-muted">{t('transactions.empty')}</p>
            ) : (
              <div className="flex flex-col gap-6">
                {summary.map((s) => {
                  const max = Math.max(s.income, s.expense, 1)
                  return (
                    <dl key={s.currency} className="flex flex-col gap-4">
                      {([
                        ['income', s.income, ArrowDownLeft, 'bg-success', 'text-success'],
                        ['expense', s.expense, ArrowUpRight, 'bg-danger', 'text-danger'],
                      ] as const).map(([kind, value, Icon, bar, tone]) => (
                        <div key={kind}>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="flex items-center gap-2 text-sm font-semibold text-muted">
                              <span className={`grid size-7 place-items-center rounded-full bg-surface-2 ${tone}`}>
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              {t(kind === 'income' ? 'transactions.income_total' : 'transactions.expense_total')}
                            </dt>
                            <dd><Amount cents={value} currency={s.currency} locale={locale} className="text-[17px] font-extrabold" /></dd>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${(value / max) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-line pt-4">
                        <dt className="text-sm font-bold">{t('transactions.net_total')}</dt>
                        <dd>
                          <Amount cents={Math.abs(s.net)} currency={s.currency} locale={locale}
                            sign={s.net >= 0 ? 'income' : 'expense'}
                            className={`text-[17px] font-extrabold ${s.net >= 0 ? 'text-success' : 'text-danger'}`} />
                        </dd>
                      </div>
                    </dl>
                  )
                })}
              </div>
            )}
          </Sheet>

          {/* Para onde foi o dinheiro */}
          <Sheet title={t('home.byCategory')} className="rise rise-3">
            {monthQuery.isPending || categoriesQuery.isPending ? <Loading /> : monthQuery.isError || categoriesQuery.isError ? (
              <QueryError onRetry={() => { void monthQuery.refetch(); void categoriesQuery.refetch() }} />
            ) : top.length === 0 ? (
              <p className="py-4 text-sm font-medium text-muted">{t('home.noExpenses')}</p>
            ) : (
              <>
                <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  {top.map((c) => (
                    <div key={c.categoryId} className="h-full first:rounded-l-full"
                      style={{ width: `${c.share * 100}%`, backgroundColor: categoriesById.get(c.categoryId)?.color }} />
                  ))}
                  {rest > 0 && <div className="h-full bg-surface-3" style={{ width: `${restShare * 100}%` }} />}
                </div>
                <ul className="flex flex-col gap-1">
                  {top.map((c) => {
                    const cat = categoriesById.get(c.categoryId)
                    const pct = Math.round(c.share * 100)
                    return (
                      <li key={c.categoryId} className="flex items-center gap-3.5 py-2">
                        {cat && <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold">{cat ? categoryLabel(cat, t) : ''}</span>
                          <span className="block text-[13px] font-medium text-muted">{t('home.spentOf', { pct })}</span>
                        </span>
                        <Amount cents={c.total} currency={breakdownCurrency!} locale={locale} className="text-[15px] font-bold" />
                      </li>
                    )
                  })}
                  {rest > 0 && (
                    <li className="flex items-center gap-3.5 py-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-extrabold text-muted">+</span>
                      <span className="min-w-0 flex-1 text-[15px] font-bold">{t('common.other')}</span>
                      <Amount cents={rest} currency={breakdownCurrency!} locale={locale} className="text-[15px] font-bold" />
                    </li>
                  )}
                </ul>
              </>
            )}
          </Sheet>
        </div>
      )}

      {/* Últimos lançamentos */}
      <Sheet title={t('home.recent')} className="rise rise-4"
        action={
          <Link to="/transactions" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-primary hover:bg-primary-soft">
            {t('home.seeAll')} <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        }>
        {recentQuery.isPending || categoriesQuery.isPending ? <Loading /> : recentQuery.isError || categoriesQuery.isError ? (
          <QueryError onRetry={() => { void recentQuery.refetch(); void categoriesQuery.refetch() }} />
        ) : recent.length === 0 ? (
          <p className="py-4 text-sm font-medium text-muted">{t('transactions.emptyBody')}</p>
        ) : (
          <ul className="-mx-3 flex flex-col">
            {recent.slice(0, 6).map((tx) => (
              <li key={tx.id}>
                <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                  account={accountsById.get(tx.account_id)} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  )
}
