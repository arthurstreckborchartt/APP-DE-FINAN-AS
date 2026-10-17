import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CreditCard, Ellipsis, Eye, EyeOff, Landmark, Target, Wallet } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { Interpolate } from '../../components/Interpolate'
import { CategoryIcon } from '../../components/CategoryIcon'
import { dayLabels, MoneyLineChart } from '../../components/MoneyLineChart'
import { Card, IconTile, RowItem, RowList, SectionHeader, SeeAllLink } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { HERO_NUMBER, HeroCard } from '../../components/ui/HeroCard'
import { QueryError } from '../../components/ui/QueryError'
import { Ring } from '../../components/ui/Ring'
import { RingCard } from '../../components/ui/RingCard'
import { SegmentedRing } from '../../components/ui/SegmentedRing'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { addDaysISO, dateFromISO, formatMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { invoiceStatus, type InvoiceStatus } from '../../lib/invoice'
import { budgetPct } from '../../lib/budget'
import { setHideValues, useHideValues } from '../../lib/privacy'
import { useAccounts } from '../accounts/api'
import { balancesByCurrency } from '../accounts/totals'
import { useBudgets } from '../budgets/api'
import { BudgetBar, BudgetRow } from '../budgets/BudgetRow'
import { budgetsWithSpent, budgetTotals, pickBudgetCurrency } from '../budgets/rows'
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
import type { Transaction } from '../transactions/types'
import { TransactionRow } from '../transactions/TransactionRow'
import { buildUpcoming, type UpcomingItem } from './upcoming'

const TOP_CATEGORIES = 5
const TOP_BUDGETS = 3

const STATUS_DOT: Record<InvoiceStatus, string> = {
  paid: 'bg-success', overdue: 'bg-danger', closed: 'bg-warning', open: 'bg-primary',
}

/** Linhas da lista: a linha inteira é o alvo; o hover escurece o Cloud. */
const ROW = 'flex items-center gap-3.5 px-3.5 py-3 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

function dayMonth(iso: string, locale: string): string {
  const date = dateFromISO(iso)
  const withYear = date.getFullYear() !== new Date().getFullYear()
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(date)
}

function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/** Locais cuja semana começa no domingo; os demais começam na segunda. */
const SUNDAY_FIRST = new Set(['pt-BR', 'en'])

function weekOf(today: string, locale: string): string[] {
  const dow = dateFromISO(today).getDay()
  const offset = SUNDAY_FIRST.has(locale) ? dow : (dow + 6) % 7
  const start = addDaysISO(today, -offset)
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
}

/** Faixa da semana: sete dias em círculos; o anel é o gasto do dia contra a média diária do mês. */
function WeekStrip({ days, today, expenses, average, currency, locale }: {
  days: string[]
  today: string
  expenses: Map<string, number>
  average: number
  currency?: string
  locale: string
}) {
  const { t } = useTranslation()
  const hidden = useHideValues()
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <ol aria-label={t('home.week')} className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const date = dateFromISO(d)
        const future = d > today
        const isToday = d === today
        const spent = expenses.get(d) ?? 0
        const ratio = average > 0 ? spent / average : 0
        const dateText = full.format(date)
        const label = future ? dateText
          : spent === 0 || !currency ? t('home.weekDayNone', { date: dateText })
          : hidden ? t('home.weekDayHidden', { date: dateText, pct: Math.round(ratio * 100) })
          : t('home.weekDay', { date: dateText, amount: formatMoney(spent, currency, locale) })
        return (
          <li key={d} className="flex justify-center">
            <span role="img" aria-label={label} aria-current={isToday ? 'date' : undefined}
              className={`flex flex-col items-center gap-1.5 ${future ? 'opacity-45' : ''}`}>
              <span className={`text-[12px] font-bold uppercase ${isToday ? 'text-fg' : 'text-muted'}`} aria-hidden="true">
                {weekday.format(date)}
              </span>
              <Ring value={future ? 0 : ratio} size={44} stroke={4} color="var(--primary)" overflowColor="var(--expense)"
                dashedTrack={future || spent === 0}>
                <span className={`num grid size-[34px] place-items-center rounded-full text-[15px] font-extrabold ${
                  isToday ? 'bg-ink text-ink-fg' : 'text-fg'}`}>
                  {date.getDate()}
                </span>
              </Ring>
            </span>
          </li>
        )
      })}
    </ol>
  )
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
  const dateClass = `block truncate text-[13px] font-medium ${overdue ? 'font-bold text-danger' : 'text-muted'}`
  if (item.type === 'recurring') {
    const r = item.recurring
    return (
      <Link to="/recurring" className={ROW}>
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
    <Link to={`/cards/${inv.card_id}`} className={ROW}>
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-bg dark:bg-surface-2" aria-hidden="true">
        <CreditCard className="size-5" style={{ color: card?.color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">{t('home.invoiceOf', { card: card?.name ?? '' })}</span>
        <span className={dateClass}>{overdue ? t('invoices.wasDue', { date: dayMonth(item.date, locale) }) : when}</span>
      </span>
      <Amount cents={inv.total} currency={inv.currency} locale={locale} className="shrink-0 whitespace-nowrap text-[15px] font-bold" />
    </Link>
  )
}

/** Cartão no Início: anel do limite usado, disponível e a fatura atual. */
function CardSummary({ card, invoice, today, locale }: { card: CardWithLimit; invoice?: InvoiceSummary; today: string; locale: string }) {
  const { t } = useTranslation()
  const used = card.limit_amount > 0 ? card.used / card.limit_amount : 0
  const status = invoice ? invoiceStatus(invoice, today) : null
  return (
    <Link to={`/cards/${card.id}`} className={`${ROW} items-start`}>
      <Ring value={used} size={48} stroke={6} color={card.color} overflowColor="var(--danger)"
        ariaLabel={`${t('cards.used')}: ${Math.round(Math.min(1, Math.max(0, used)) * 100)}%`}>
        <CreditCard className="size-4" style={{ color: card.color }} aria-hidden="true" />
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">{card.name}</span>
          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-muted">{t('home.availableLimit')}</span>
          <Amount cents={card.available} currency={card.currency} locale={locale} className="text-[15px] font-extrabold" />
        </span>
        {invoice && status && (
          <>
            <span className="mt-1 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted">
                <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                <span className="truncate">{t('cards.currentInvoice')} · {t(`invoices.status.${status}`)}</span>
              </span>
              <Amount cents={invoice.total} currency={invoice.currency} locale={locale} className="shrink-0 text-[15px] font-bold" />
            </span>
            <span className="mt-0.5 block pl-3.5 text-[13px] font-medium text-muted">
              {t(status === 'overdue' ? 'invoices.wasDue' : 'invoices.due', { date: dayMonth(invoice.due_date, locale) })}
            </span>
          </>
        )}
      </span>
    </Link>
  )
}

function Loading() {
  return <div className="grid place-items-center py-8 text-primary"><Spinner /></div>
}

function sumExpensesByDay(entries: Transaction[], currency: string | undefined): Map<string, number> {
  const out = new Map<string, number>()
  if (!currency) return out
  for (const tx of entries) {
    if (tx.kind !== 'expense' || tx.currency !== currency) continue
    out.set(tx.date, (out.get(tx.date) ?? 0) + tx.amount)
  }
  return out
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const hidden = useHideValues()
  const { data: profile } = useProfile()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const categories = categoriesQuery.data ?? []
  const today = todayISO()
  const month = monthOf(today)
  const week = useMemo(() => weekOf(today, locale), [today, locale])
  const monthQuery = useTransactions(month)
  // A semana pode começar no mês anterior; mesmo mês = mesma consulta (sem pedido extra).
  const weekStartQuery = useTransactions(monthOf(week[0]))
  const recentQuery = useRecentTransactions()
  const cardsQuery = useCards()
  const invoicesQuery = useAllOpenInvoices()
  const paidQuery = usePaidInvoicesInMonth(month)
  const recurringQuery = useRecurring()
  const budgetsQuery = useBudgets()
  const monthTx = monthQuery.data ?? []
  const recent = recentQuery.data ?? []

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map((accountsQuery.data ?? []).map((a) => [a.id, a])), [accountsQuery.data])
  const activeCards = useMemo(() => (cardsQuery.data ?? []).filter((c) => !c.archived), [cardsQuery.data])
  const cardsById = useMemo(() => new Map((cardsQuery.data ?? []).map((c) => [c.id, c])), [cardsQuery.data])
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
  const mainCurrency = profile?.currency ?? summary[0]?.currency ?? balances[0]?.currency
  const main = summary.find((s) => s.currency === mainCurrency) ?? { income: 0, expense: 0 }
  const breakdownCurrency =
    summary.find((s) => s.currency === profile?.currency && s.expense > 0)?.currency ??
    summary.find((s) => s.expense > 0)?.currency
  const breakdown = breakdownCurrency ? expensesByCategory(monthTx, breakdownCurrency) : []
  const top = breakdown.slice(0, TOP_CATEGORIES)
  const rest = breakdown.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.total, 0)
  // Orçamento do mês na moeda principal do perfil.
  // Sem orçamento na moeda do perfil, usa a moeda com maior limite somado.
  const budgetCurrency = pickBudgetCurrency(budgetsQuery.data ?? [], profile?.currency)
  const budgetRows = budgetCurrency ? budgetsWithSpent(budgetsQuery.data ?? [], monthTx, budgetCurrency) : []
  const budgetTotal = budgetTotals(budgetRows)
  const showBudget = showMonth || budgetRows.length > 0 || budgetsQuery.isError
  const firstName = profile?.name?.trim().split(/\s+/)[0]

  // Destaque: com orçamento na moeda principal, quanto ainda dá para gastar; senão, o saldo nas contas.
  const heroMode = budgetRows.length > 0 && budgetCurrency === mainCurrency ? 'budget' : 'balance'
  const heroLoading = budgetsQuery.isPending || monthQuery.isPending
  const left = budgetTotal.limit - budgetTotal.spent
  const mainBalance = balances.find((b) => b.currency === mainCurrency) ?? balances[0]
  const otherBalances = balances.filter((b) => b !== mainBalance)

  // Gráficos do mês: só até hoje (o resto do mês ainda não aconteceu).
  const todayDay = Number(today.slice(8, 10))
  const labels = dayLabels(month, daysInMonth(month), locale).slice(0, todayDay)
  const balanceCurrency = mainBalance?.currency
  const balanceSeries = balanceCurrency && monthQuery.isSuccess && paidQuery.isSuccess
    ? dailyBalance({
        currentBalance: mainBalance.total,
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

  // Semana: gasto de cada dia na moeda principal contra a média diária do mês até hoje.
  const weekEntries = monthOf(week[0]) === month ? monthTx : [...(weekStartQuery.data ?? []), ...monthTx]
  const weekExpenses = sumExpensesByDay(weekEntries, mainCurrency)
  const dailyAverage = main.expense / Math.max(1, todayDay)

  // Cartões na moeda principal: limite livre e quanto está em uso.
  const mainCards = activeCards.filter((c) => c.currency === mainCurrency)
  const cardLimit = mainCards.reduce((s, c) => s + c.limit_amount, 0)
  const cardUsed = mainCards.reduce((s, c) => s + c.used, 0)
  const cardAvailable = mainCards.reduce((s, c) => s + c.available, 0)

  // Nos três cartões de anel, no celular estreito o valor vai sem centavos (o exato está em "Este mês").
  const tileAmount = (cents: number, currency: string) => (
    <>
      <Amount whole cents={cents} currency={currency} locale={locale} className="sm:hidden" />
      <Amount cents={cents} currency={currency} locale={locale} className="max-sm:hidden" />
    </>
  )

  const eye = (
    <button type="button" onClick={() => setHideValues(!hidden)}
      aria-label={hidden ? t('home.showValues') : t('home.hideValues')} aria-pressed={hidden}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-fg transition hover:bg-surface-3">
      {hidden ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
    </button>
  )

  const accountsLink = (
    <Link to="/accounts"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm font-bold text-fg transition hover:bg-surface-3">
      <Wallet className="size-4" aria-hidden="true" />
      {t('home.accounts', { count: activeAccounts.length })}
      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
    </Link>
  )

  const heroRing = heroMode === 'budget'
    ? { value: budgetTotal.limit > 0 ? budgetTotal.spent / budgetTotal.limit : 0, icon: Wallet,
        text: t('home.heroBudgetRing', { pct: budgetPct(budgetTotal.spent, budgetTotal.limit) }) }
    : { value: main.income > 0 ? main.expense / main.income : main.expense > 0 ? 1 : 0, icon: Landmark,
        text: main.income > 0 ? t('home.heroIncomeRing', { pct: pctOf(main.expense, main.income) }) : t('home.heroNoIncome') }
  const HeroIcon = heroRing.icon

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
      <div className="max-lg:contents lg:flex lg:flex-col lg:gap-6">
        {/* Semana */}
        <div className="max-lg:order-1">
          <WeekStrip days={week} today={today} expenses={weekExpenses} average={dailyAverage} currency={mainCurrency} locale={locale} />
        </div>

        {/* Destaque: quanto sobra (ou o saldo) ao lado do anel */}
        <HeroCard className="max-lg:order-2"
          top={<>
            <p className="min-w-0 truncate text-[15px] font-semibold text-muted">
              {profile ? (firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')) : ' '}
            </p>
            {eye}
          </>}
          value={heroLoading ? (
            <span className="inline-block py-2 text-primary"><Spinner className="size-7" /></span>
          ) : heroMode === 'budget' ? (
            <Amount cents={Math.abs(left)} currency={budgetCurrency!} locale={locale} smallSymbol
              className={`${HERO_NUMBER} ${left < 0 ? 'text-danger' : ''}`} />
          ) : mainBalance ? (
            <Amount cents={mainBalance.total} currency={mainBalance.currency} locale={locale} smallSymbol className={HERO_NUMBER} />
          ) : (
            <span className={`num ${HERO_NUMBER}`}>—</span>
          )}
          label={heroMode === 'budget' ? t(left < 0 ? 'home.overBudget' : 'home.leftToSpend') : t('home.balance')}
          detail={heroMode === 'balance' && otherBalances.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-[15px] font-bold text-muted">
              {otherBalances.map((b) => <Amount key={b.currency} cents={b.total} currency={b.currency} locale={locale} />)}
            </p>
          )}
          caption={heroRing.text}
          ring={
            <Ring value={heroRing.value} size={100} stroke={10} color="var(--primary)" overflowColor="var(--expense)"
              ariaLabel={heroRing.text}>
              <HeroIcon className="size-7 text-primary" aria-hidden="true" />
            </Ring>
          }>
          {heroMode === 'balance' && <div className="mt-4">{accountsLink}</div>}
        </HeroCard>

        {activeAccounts.length === 0 && (
          <div className="max-lg:order-3"><EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
            action={<Link to="/accounts" className="mt-1 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-ink-fg hover:bg-ink-hover">{t('accounts.new')}</Link>} /></div>
        )}

        {/* Entradas, saídas e cartões em anéis */}
        <ul className="grid grid-cols-3 gap-2 max-lg:order-4 sm:gap-3">
          <li className="contents">
            <RingCard to="/transactions" icon={ArrowDownLeft} color="var(--income)"
              label={t('transactions.income_total')}
              value={monthQuery.isPending || !mainCurrency ? '—' : tileAmount(main.income, mainCurrency)}
              ring={main.expense > 0 ? main.income / main.expense : main.income > 0 ? 1 : 0}
              ringLabel={t('home.ringIncome', { pct: main.expense > 0 ? pctOf(main.income, main.expense) : main.income > 0 ? 100 : 0 })} />
          </li>
          <li className="contents">
            <RingCard to="/transactions" icon={ArrowUpRight} color="var(--expense)" overflowColor="var(--danger)"
              label={t('transactions.expense_total')}
              value={monthQuery.isPending || !mainCurrency ? '—' : tileAmount(main.expense, mainCurrency)}
              ring={main.income > 0 ? main.expense / main.income : main.expense > 0 ? 1 : 0}
              ringLabel={t('home.ringExpense', { pct: main.income > 0 ? pctOf(main.expense, main.income) : main.expense > 0 ? 100 : 0 })} />
          </li>
          <li className="contents">
            <RingCard to="/cards" icon={CreditCard} color="var(--limit)" overflowColor="var(--danger)"
              label={mainCards.length > 0 ? t('home.cardsFree') : t('home.noCards')}
              value={cardsQuery.isPending || mainCards.length === 0 ? '—' : tileAmount(cardAvailable, mainCurrency!)}
              ring={cardLimit > 0 ? cardUsed / cardLimit : 0}
              ringLabel={t('home.ringCards', { pct: pctOf(cardUsed, cardLimit) })} />
          </li>
        </ul>

        {/* Orçamento do mês */}
        {showBudget && (
          <Card className="max-lg:order-6">
            <SectionHeader title={t('home.budget')} action={budgetRows.length > 0 && <SeeAllLink to="/budgets">{t('home.seeAll')}</SeeAllLink>} />
            {budgetsQuery.isPending || monthQuery.isPending || categoriesQuery.isPending ? <Loading /> : budgetsQuery.isError || monthQuery.isError || categoriesQuery.isError ? (
              <QueryError onRetry={() => { void budgetsQuery.refetch(); void monthQuery.refetch(); void categoriesQuery.refetch() }} />
            ) : budgetRows.length === 0 ? (
              <div className="flex flex-col items-start gap-3 py-1">
                <p className="text-sm font-medium text-muted">{t('home.budgetEmpty')}</p>
                <Link to="/budgets" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-ink-fg transition hover:bg-ink-hover">
                  <Target className="size-4" aria-hidden="true" /> {t('home.budgetCta')}
                </Link>
              </div>
            ) : (
              <>
                {heroMode !== 'budget' && (
                  <div className="mb-4">
                    <span className="mb-3 inline-block rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-extrabold text-muted">{budgetCurrency}</span>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-[15px] font-medium text-muted">
                        <Interpolate i18nKey="budgets.spentOf" values={{
                          spent: <Amount cents={budgetTotal.spent} currency={budgetCurrency!} locale={locale} className="text-[20px] font-extrabold tracking-[-0.02em] text-fg" />,
                          limit: <Amount cents={budgetTotal.limit} currency={budgetCurrency!} locale={locale} className="font-bold" />,
                        }} />
                      </p>
                      <span className="num shrink-0 text-[15px] font-extrabold">{t('budgets.pct', { pct: budgetPct(budgetTotal.spent, budgetTotal.limit) })}</span>
                    </div>
                    <BudgetBar spent={budgetTotal.spent} limit={budgetTotal.limit} label={t('home.budget')} className="mt-2.5" />
                  </div>
                )}
                <ul className="flex flex-col">
                  {budgetRows.slice(0, TOP_BUDGETS).map((r) => (
                    <li key={r.budget.id}>
                      <BudgetRow compact category={categoriesById.get(r.budget.category_id)} spent={r.spent}
                        limit={r.budget.amount} currency={r.budget.currency} locale={locale} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        {/* Para onde foi o dinheiro */}
        {showMonth && (
          <Card className="max-lg:order-7">
            <SectionHeader title={t('home.byCategory')} />
            {monthQuery.isPending || categoriesQuery.isPending ? <Loading /> : monthQuery.isError || categoriesQuery.isError ? (
              <QueryError onRetry={() => { void monthQuery.refetch(); void categoriesQuery.refetch() }} />
            ) : top.length === 0 ? (
              <p className="py-4 text-sm font-medium text-muted">{t('home.noExpenses')}</p>
            ) : (
              <>
                <div className="@container">
                <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-start">
                <SegmentedRing size={136} stroke={13} ariaLabel={t('home.byCategory')} className="@md:mt-1"
                  segments={[
                    ...top.map((c) => ({ key: c.categoryId, value: c.total, color: categoriesById.get(c.categoryId)?.color ?? 'var(--muted)' })),
                    ...(rest > 0 ? [{ key: 'rest', value: rest, color: 'var(--surface-3)' }] : []),
                  ]}>
                  <span className="flex max-w-[96px] flex-col items-center">
                    <Amount cents={top.reduce((sum, c) => sum + c.total, 0) + rest} currency={breakdownCurrency!} locale={locale} whole
                      className="text-[17px] font-extrabold leading-tight tracking-[-0.03em]" />
                    <span className="text-[12px] font-semibold text-muted">{t('transactions.expense_total')}</span>
                  </span>
                </SegmentedRing>
                <ul className="-mx-2 flex w-full min-w-0 flex-col @md:flex-1">
                  {top.map((c) => {
                    const cat = categoriesById.get(c.categoryId)
                    const pct = Math.round(c.share * 100)
                    return (
                      <li key={c.categoryId}>
                        <Link to={`/transactions?m=${month}&c=${c.categoryId}`}
                          className="flex items-center gap-3.5 rounded-[18px] px-2 py-2 transition hover:bg-surface-2">
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
                    <li className="flex items-center gap-3.5 px-2 py-2">
                      <IconTile icon={Ellipsis} size="sm" className="text-muted" />
                      <span className="min-w-0 flex-1 text-[15px] font-bold">{t('common.other')}</span>
                      <Amount cents={rest} currency={breakdownCurrency!} locale={locale} className="text-[15px] font-bold" />
                    </li>
                  )}
                </ul>
                </div>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Saldo nas contas (quando o destaque é o orçamento) e a evolução do saldo */}
        {(heroMode === 'budget' || balanceSeries.length > 1) && (
          <Card className="max-lg:order-9">
            <SectionHeader title={heroMode === 'budget' ? t('home.balance') : t('home.balanceTrend')} />
            {heroMode === 'budget' && (
              balances.length === 0 ? (
                <p className="num text-[34px] font-extrabold leading-tight">—</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {balances.map((b) => (
                    <Amount key={b.currency} cents={b.total} currency={b.currency} locale={locale}
                      className={b === mainBalance
                        ? 'text-[34px] font-extrabold leading-tight tracking-[-0.035em]'
                        : 'text-[17px] font-bold text-muted'} />
                  ))}
                </div>
              )
            )}
            {balanceSeries.length > 1 && (
              <div className="-mx-1 mt-3">
                <MoneyLineChart values={balanceSeries} labels={labels} currency={balanceCurrency!} locale={locale}
                  name={t('home.balanceTrend')} showXAxis={false} />
              </div>
            )}
            {heroMode === 'budget' && <div className="mt-4">{accountsLink}</div>}
          </Card>
        )}

        {/* Seus cartões */}
        {activeCards.length > 0 && (
          <section className="max-lg:order-11">
            <SectionHeader title={t('home.cards')} action={<SeeAllLink to="/cards">{t('home.seeAll')}</SeeAllLink>} />
            <RowList>
              {activeCards.map((c) => (
                <RowItem key={c.id}><CardSummary card={c} invoice={currentInvoice.get(c.id)} today={today} locale={locale} /></RowItem>
              ))}
            </RowList>
          </section>
        )}
      </div>

      <div className="max-lg:contents lg:flex lg:flex-col lg:gap-6">
        {/* Últimos lançamentos */}
        <section className="max-lg:order-5">
          <SectionHeader title={t('home.recent')} action={<SeeAllLink to="/transactions">{t('home.seeAll')}</SeeAllLink>} />
          {recentQuery.isPending || categoriesQuery.isPending ? <Loading /> : recentQuery.isError || categoriesQuery.isError ? (
            <QueryError onRetry={() => { void recentQuery.refetch(); void categoriesQuery.refetch() }} />
          ) : recent.length === 0 ? (
            <p className="rounded-card bg-surface px-5 py-6 text-sm font-medium text-muted">{t('transactions.emptyBody')}</p>
          ) : (
            <RowList>
              {recent.slice(0, 6).map((tx) => (
                <RowItem key={tx.id}>
                  <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                    account={tx.account_id ? accountsById.get(tx.account_id) : undefined}
                    card={tx.card_id ? cardsById.get(tx.card_id) : undefined} locale={locale} />
                </RowItem>
              ))}
            </RowList>
          )}
        </section>

        {/* Próximos vencimentos */}
        <section className="max-lg:order-10">
          <SectionHeader title={t('home.upcoming')} />
          {recurringQuery.isPending || invoicesQuery.isPending ? <Loading /> : recurringQuery.isError || invoicesQuery.isError ? (
            <QueryError onRetry={() => { void recurringQuery.refetch(); void invoicesQuery.refetch() }} />
          ) : upcoming.length === 0 ? (
            <p className="rounded-card bg-surface px-5 py-6 text-sm font-medium text-muted">{t('home.upcomingEmpty')}</p>
          ) : (
            <RowList>
              {upcoming.map((item) => (
                <RowItem key={item.key}>
                  <UpcomingRow item={item} today={today} locale={locale}
                    category={item.type === 'recurring' ? categoriesById.get(item.recurring.category_id) : undefined}
                    card={item.type === 'invoice' ? cardsById.get(item.invoice.card_id) : undefined} />
                </RowItem>
              ))}
            </RowList>
          )}
        </section>

        {/* Este mês, por moeda */}
        {showMonth && (
          <Card className="max-lg:order-8">
            <SectionHeader title={t('home.thisMonth')}
              action={<span className="inline-block text-[13px] font-semibold text-muted first-letter:uppercase">{formatMonth(month, locale)}</span>} />
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
                        ['income', s.income, ArrowDownLeft, 'bg-income', 'text-income'],
                        ['expense', s.expense, ArrowUpRight, 'bg-expense', 'text-expense'],
                      ] as const).map(([kind, value, Icon, bar, tone]) => (
                        <div key={kind}>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="flex items-center gap-2.5 text-sm font-semibold text-muted">
                              <span className={`grid size-8 place-items-center rounded-[10px] bg-bg dark:bg-surface-2 ${tone}`}>
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              {t(kind === 'income' ? 'transactions.income_total' : 'transactions.expense_total')}
                            </dt>
                            <dd><Amount cents={value} currency={s.currency} locale={locale} className="text-[17px] font-extrabold" /></dd>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ring-track" aria-hidden="true">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${(value / max) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-surface-3/70 pt-4">
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
                  <div className="border-t border-surface-3/70 pt-4">
                    <p className="mb-3 text-[13px] font-semibold text-muted">{t('home.spentSoFar')}</p>
                    <MoneyLineChart values={spendingSeries} labels={labels} currency={breakdownCurrency!} locale={locale}
                      name={t('home.spentSoFar')} />
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
