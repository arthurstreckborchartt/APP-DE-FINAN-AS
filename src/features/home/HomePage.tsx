import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Ellipsis, Eye, EyeOff, Landmark, Plus, ReceiptText, Tags, Wallet } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { dayLabels, MoneyLineChart } from '../../components/MoneyLineChart'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { addDaysISO, dateFromISO, formatMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { invoiceStatus, type InvoiceStatus } from '../../lib/invoice'
import { setHideValues, useHideValues } from '../../lib/privacy'
import { useAccounts } from '../accounts/api'
import { balancesByCurrency } from '../accounts/totals'
import { useCards } from '../cards/api'
import { useAllOpenInvoices, usePaidInvoicesInMonth } from '../cards/invoicesApi'
import type { CardWithLimit, InvoiceSummary } from '../cards/types'
import type { Category } from '../categories/types'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useRecurring } from '../recurring/api'
import { useProfile } from '../profile/api'
import { useRecentTransactions, useTransactions } from '../transactions/api'
import { expensesByCategory, summarizeByCurrency } from '../transactions/filters'
import { cumulative, dailyBalance, dailyExpenses, daysInMonth } from '../transactions/series'
import { TransactionRow } from '../transactions/TransactionRow'
import { buildUpcoming, type UpcomingItem } from './upcoming'

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

const STATUS_DOT: Record<InvoiceStatus, string> = {
  paid: 'bg-success', overdue: 'bg-danger', closed: 'bg-warning', open: 'bg-primary',
}

function dayMonth(iso: string, locale: string): string {
  const date = dateFromISO(iso)
  const withYear = date.getFullYear() !== new Date().getFullYear()
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(date)
}

/** Linha de "Próximos vencimentos": recorrente ou fatura de cartão. */
function UpcomingRow({ item, category, card, today, locale }: {
  item: UpcomingItem
  category?: Category
  card?: CardWithLimit
  today: string
  locale: string
}) {
  const { t } = useTranslation()
  const overdue = item.type === 'invoice' && item.overdue
  const when = item.date === today ? t('transactions.today')
    : item.date === addDaysISO(today, 1) ? t('common.tomorrow')
    : dayMonth(item.date, locale)
  const rowClass = '-mx-3 flex items-center gap-3.5 rounded-2xl px-3 py-2.5 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary'
  const dateClass = `block truncate text-[13px] font-medium ${overdue ? 'font-bold text-danger' : 'text-muted'}`
  if (item.type === 'recurring') {
    const r = item.recurring
    return (
      <Link to="/recurring" className={rowClass}>
        {category && <CategoryIcon icon={category.icon} color={category.color} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">{r.description || (category ? categoryLabel(category, t) : '')}</span>
          <span className={dateClass}>{when}</span>
        </span>
        <Amount cents={r.amount} currency={r.currency} locale={locale} sign={r.kind}
          className={`shrink-0 whitespace-nowrap text-[15px] font-bold ${r.kind === 'income' ? 'text-success' : 'text-fg'}`} />
      </Link>
    )
  }
  const inv = item.invoice
  return (
    <Link to={`/cards/${inv.card_id}`} className={rowClass}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2" aria-hidden="true">
        <span className="size-3.5 rounded-full" style={{ backgroundColor: card?.color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">{t('home.invoiceOf', { card: card?.name ?? '' })}</span>
        <span className={dateClass}>{overdue ? t('invoices.wasDue', { date: dayMonth(item.date, locale) }) : when}</span>
      </span>
      <Amount cents={inv.total} currency={inv.currency} locale={locale} className="shrink-0 whitespace-nowrap text-[15px] font-bold" />
    </Link>
  )
}

/** Cartão compacto no Início: disponível com barra e a fatura atual. */
function CardSummary({ card, invoice, today, locale }: { card: CardWithLimit; invoice?: InvoiceSummary; today: string; locale: string }) {
  const { t } = useTranslation()
  const pct = card.limit_amount > 0 ? Math.min(100, Math.max(0, (card.used / card.limit_amount) * 100)) : 0
  const status = invoice ? invoiceStatus(invoice, today) : null
  return (
    <Link to={`/cards/${card.id}`}
      className="-mx-3 block rounded-2xl px-3 py-3 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
      <span className="flex items-center gap-2.5">
        <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: card.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">{card.name}</span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </span>
      <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-surface-2" role="img"
        aria-label={`${t('cards.used')}: ${Math.round(pct)}%`}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: card.color }} />
      </span>
      <span className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-muted">{t('home.availableLimit')}</span>
        <Amount cents={card.available} currency={card.currency} locale={locale} className="text-[15px] font-extrabold" />
      </span>
      {invoice && status && (
        <span className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted">
            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
            <span className="truncate">{t('cards.currentInvoice')} · {t(`invoices.status.${status}`)}</span>
          </span>
          <Amount cents={invoice.total} currency={invoice.currency} locale={locale} className="shrink-0 text-[15px] font-bold" />
        </span>
      )}
      {invoice && status && (
        <span className="mt-0.5 block pl-3.5 text-[13px] font-medium text-muted">
          {t(status === 'overdue' ? 'invoices.wasDue' : 'invoices.due', { date: dayMonth(invoice.due_date, locale) })}
        </span>
      )}
    </Link>
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
  const cardsQuery = useCards()
  const invoicesQuery = useAllOpenInvoices()
  const paidQuery = usePaidInvoicesInMonth(month)
  const recurringQuery = useRecurring()
  const monthTx = monthQuery.data ?? []
  const recent = recentQuery.data ?? []

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map((accountsQuery.data ?? []).map((a) => [a.id, a])), [accountsQuery.data])
  const activeCards = useMemo(() => (cardsQuery.data ?? []).filter((c) => !c.archived), [cardsQuery.data])
  const cardsById = useMemo(() => new Map((cardsQuery.data ?? []).map((c) => [c.id, c])), [cardsQuery.data])
  const today = todayISO()
  // Fatura atual de cada cartão: a mais antiga não paga com valor; senão a próxima a fechar.
  const currentInvoice = useMemo(() => {
    const open = invoicesQuery.data ?? []
    return new Map(activeCards.map((c) => {
      const own = open.filter((i) => i.card_id === c.id)
      return [c.id, own.find((i) => i.total > 0) ?? own.find((i) => i.closing_date >= today)] as const
    }))
  }, [activeCards, invoicesQuery.data, today])

  const upcoming = useMemo(
    () => buildUpcoming(recurringQuery.data ?? [], invoicesQuery.data ?? [], today),
    [recurringQuery.data, invoicesQuery.data, today],
  )

  if (accountsQuery.isPending) return <div className="min-h-[40vh]"><FullScreenSpinner /></div>
  if (accountsQuery.isError) return <QueryError onRetry={() => void accountsQuery.refetch()} />

  const accounts = accountsQuery.data
  const activeAccounts = accounts.filter((a) => !a.archived)
  const showMonth = activeAccounts.length > 0 || monthTx.length > 0
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

  // Gráficos do mês: só até hoje (o resto do mês ainda não aconteceu).
  const todayDay = Number(today.slice(8, 10))
  const labels = dayLabels(month, daysInMonth(month), locale).slice(0, todayDay)
  const balanceCurrency = balances.find((b) => b.currency === profile?.currency)?.currency ?? balances[0]?.currency
  const balanceSeries = balanceCurrency && monthQuery.isSuccess && paidQuery.isSuccess
    ? dailyBalance({
        currentBalance: balances.find((b) => b.currency === balanceCurrency)!.total,
        month,
        currency: balanceCurrency,
        entries: monthTx,
        payments: (paidQuery.data ?? []).map((i) => ({
          date: todayISO(new Date(i.paid_at!)),
          amount: i.payment_amount ?? 0,
          currency: i.currency,
        })),
      }).slice(0, todayDay)
    : []
  const spendingSeries = breakdownCurrency
    ? cumulative(dailyExpenses(monthTx, month, breakdownCurrency)).slice(0, todayDay)
    : []

  const quick = [
    { to: '/new', label: t('nav.new'), icon: Plus, primary: true },
    { to: '/transactions', label: t('nav.transactions'), icon: ReceiptText },
    { to: '/accounts', label: t('accounts.title'), icon: Landmark },
    { to: '/categories', label: t('categories.title'), icon: Tags },
  ]

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6">
      {/* Atalhos */}
      <nav aria-label={t('home.quickActions')} className="order-2 grid grid-cols-4 gap-2 sm:max-w-xl lg:hidden">
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

      <div className="max-lg:contents lg:flex lg:flex-col lg:gap-6">
      {/* Painel de saldo */}
        <section className="brand-panel balance-reveal relative overflow-hidden rounded-[28px] p-6 shadow-float sm:p-8 max-lg:order-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-brand-muted">
                {profile ? (firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')) : ' '}
              </p>
              <p className="mt-5 text-[15px] font-medium text-brand-muted">{t('home.balance')}</p>
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
          {balanceSeries.length > 1 && (
            <div className="-mx-1 mt-4">
              <MoneyLineChart values={balanceSeries} labels={labels} currency={balanceCurrency!} locale={locale}
                name={t('home.balanceTrend')} color="#ffffff" showXAxis={false}
                className="[--spell-badge:rgb(255_255_255/0.16)] [--spell-line:rgb(255_255_255/0.4)] dark:[--spell-badge:rgb(255_255_255/0.16)] dark:[--spell-line:rgb(255_255_255/0.4)]" />
            </div>
          )}
          <Link to="/accounts"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20">
            <Wallet className="size-4" aria-hidden="true" />
            {t('home.accounts', { count: activeAccounts.length })}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      {activeAccounts.length === 0 && (
        <div className="max-lg:order-3"><EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
          action={<Link to="/accounts" className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-fg">{t('accounts.new')}</Link>} /></div>
      )}
      {showMonth && (
        <>
      {/* Para onde foi o dinheiro */}
      <Sheet title={t('home.byCategory')} className="max-lg:order-4">
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
                  <li key={c.categoryId}>
                    <Link to={`/transactions?m=${month}&c=${c.categoryId}`}
                      className="-mx-3 flex items-center gap-3.5 rounded-2xl px-3 py-2 transition hover:bg-surface-2">
                    {cat && <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{cat ? categoryLabel(cat, t) : ''}</span>
                      <span className="block text-[13px] font-medium text-muted">{t('home.spentOf', { pct })}</span>
                    </span>
                    <Amount cents={c.total} currency={breakdownCurrency!} locale={locale} className="text-[15px] font-bold" />
                    </Link>
                  </li>
                )
              })}
              {rest > 0 && (
                <li className="flex items-center gap-3.5 py-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><Ellipsis className="size-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold">{t('common.other')}</span>
                  <Amount cents={rest} currency={breakdownCurrency!} locale={locale} className="text-[15px] font-bold" />
                </li>
              )}
            </ul>
          </>
        )}
      </Sheet>
        </>
      )}
      {/* Seus cartões */}
      {activeCards.length > 0 && (
        <Sheet title={t('home.cards')} className="max-lg:order-5"
          action={
            <Link to="/cards" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-primary hover:bg-primary-soft">
              {t('home.seeAll')} <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          }>
          <ul className="flex flex-col">
            {activeCards.map((c) => (
              <li key={c.id}><CardSummary card={c} invoice={currentInvoice.get(c.id)} today={today} locale={locale} /></li>
            ))}
          </ul>
        </Sheet>
      )}
      </div>

      <div className="max-lg:contents lg:flex lg:flex-col lg:gap-6">
      {showMonth && (
        <>
      {/* Este mês */}
      <Sheet title={t('home.thisMonth')} className="max-lg:order-3"
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
                  {summary.length > 1 && (
                    <span className="self-start rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-extrabold text-muted">
                      {s.currency}
                    </span>
                  )}
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
            {spendingSeries.length > 1 && (
              <div className="border-t border-line pt-4">
                <p className="mb-3 text-[13px] font-semibold text-muted">{t('home.spentSoFar')}</p>
                <MoneyLineChart values={spendingSeries} labels={labels} currency={breakdownCurrency!} locale={locale}
                  name={t('home.spentSoFar')} />
              </div>
            )}
          </div>
        )}
      </Sheet>
        </>
      )}
      {/* Próximos vencimentos */}
      <Sheet title={t('home.upcoming')} className="max-lg:order-6">
        {recurringQuery.isPending || invoicesQuery.isPending ? <Loading /> : recurringQuery.isError || invoicesQuery.isError ? (
          <QueryError onRetry={() => { void recurringQuery.refetch(); void invoicesQuery.refetch() }} />
        ) : upcoming.length === 0 ? (
          <p className="py-4 text-sm font-medium text-muted">{t('home.upcomingEmpty')}</p>
        ) : (
          <ul className="flex flex-col">
            {upcoming.map((item) => (
              <li key={item.key}>
                <UpcomingRow item={item} today={today} locale={locale}
                  category={item.type === 'recurring' ? categoriesById.get(item.recurring.category_id) : undefined}
                  card={item.type === 'invoice' ? cardsById.get(item.invoice.card_id) : undefined} />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {/* Últimos lançamentos */}
      <Sheet title={t('home.recent')} className="max-lg:order-7"
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
                  account={tx.account_id ? accountsById.get(tx.account_id) : undefined}
                  card={tx.card_id ? cardsById.get(tx.card_id) : undefined} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      </div>
    </div>
  )
}
