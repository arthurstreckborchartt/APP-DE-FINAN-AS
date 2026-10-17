import { useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChartColumn } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { BarChart, type BarSeries } from '../../components/ui/BarChart'
import { PageHeader, SectionHeader } from '../../components/ui/Card'
import { CHIP_BUTTON } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/SelectField'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { formatMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useHideValues } from '../../lib/privacy'
import { useAccounts } from '../accounts/api'
import { useAuth } from '../auth/auth-context'
import { useCards } from '../cards/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useGroupMembers, useMyGroups } from '../groups/api'
import { MEMBER_COLORS, memberColorOf, memberDisplayName } from '../groups/display'
import { MemberShares } from '../groups/MemberShares'
import { groupMonthStats } from '../groups/stats'
import type { Group } from '../groups/types'
import { useEntriesRange, useGroupPeriodEntries } from './api'
import {
  categoryTotals, currenciesOf, memberMonthly, monthlyTotals, monthsBetween, periodMonths, type ReportPreset,
} from './aggregate'

const PRESETS: ReportPreset[] = ['last3', 'last6', 'last12', 'thisYear']
const MAX_SERIES = MEMBER_COLORS.length

type Period = { months: string[]; from: string; to: string; labels: string[]; titles: string[] }

function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card bg-surface p-5 sm:p-6 ${className}`}>
      {title && <SectionHeader title={title} />}
      {children}
    </section>
  )
}

function Loading() {
  return <div className="grid place-items-center py-12 text-primary"><Spinner /></div>
}

function ControlLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-semibold text-muted">{children}</span>
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <div className="mt-1 truncate text-[19px] font-extrabold tracking-[-0.03em] sm:text-[24px] sm:tracking-[-0.04em]">{children}</div>
    </div>
  )
}

/** Rótulo do gráfico para o leitor de tela; avisa quando os valores estão ocultos ("••••"). */
function useChartLabel() {
  const { t } = useTranslation()
  const hidden = useHideValues()
  return (title: string) => (hidden ? `${title}. ${t('reports.chartHidden')}` : title)
}

function useMoneyFormats(currency: string, locale: string) {
  return useMemo(() => {
    const compact = new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 })
    return {
      format: (v: number) => formatMoney(v, currency, locale),
      formatTick: (v: number) => compact.format(v / 100),
    }
  }, [currency, locale])
}

type CategoryItem = { id: string; label: string; icon: string; color: string; amount: number; share: number }

/** Barra empilhada fina (como no Início) e a lista das categorias com a fatia de cada uma. */
function CategoryBreakdown({ items, currency, locale }: { items: CategoryItem[]; currency: string; locale: string }) {
  const { t } = useTranslation()
  const total = items.reduce((s, c) => s + c.amount, 0)
  if (items.length === 0) return <p className="py-2 text-sm font-medium text-muted">{t('reports.empty')}</p>
  return (
    <>
      <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-ring-track" aria-hidden="true">
        {items.map((c) => (
          <div key={c.id} className="h-full" style={{ width: `${total > 0 ? (c.amount / total) * 100 : 0}%`, backgroundColor: c.color }} />
        ))}
      </div>
      <ul className="flex flex-col">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3.5 py-1.5">
            <CategoryIcon icon={c.icon} color={c.color} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{c.label}</span>
              <span className="block text-[13px] font-medium text-muted">{t('reports.share', { pct: c.share })}</span>
            </span>
            <Amount cents={c.amount} currency={currency} locale={locale} className="shrink-0 text-[15px] font-bold" />
          </li>
        ))}
      </ul>
    </>
  )
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [params, setParams] = useSearchParams()
  const groupsQuery = useMyGroups()

  const rawPeriod = params.get('period') as ReportPreset | null
  const preset: ReportPreset = rawPeriod && PRESETS.includes(rawPeriod) ? rawPeriod : 'last6'
  const scope = params.get('scope') ?? 'personal'
  const groups = groupsQuery.data ?? []
  const group = scope === 'personal' ? undefined : groups.find((g) => g.id === scope)

  const period = useMemo<Period>(() => {
    const { from, to } = periodMonths(preset, monthOf(todayISO()))
    const months = monthsBetween(from, to)
    const short = new Intl.DateTimeFormat(locale, { month: 'short' })
    return {
      months, from, to,
      labels: months.map((m) => short.format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))),
      titles: months.map((m) => formatMonth(m, locale)),
    }
  }, [preset, locale])

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // Grupo na URL ainda carregando: espera em vez de mostrar o pessoal por um instante.
  const waitingGroup = scope !== 'personal' && groupsQuery.isPending
  const groupsFailed = scope !== 'personal' && groupsQuery.isError

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-6">
        {groups.length > 0 && (
          <div className="min-w-0">
            <ControlLabel>{t('reports.scope')}</ControlLabel>
            <div role="radiogroup" aria-label={t('reports.scope')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[{ id: 'personal', name: t('reports.personal') }, ...groups].map((g) => {
                const on = g.id === 'personal' ? !group && !waitingGroup && !groupsFailed : g.id === group?.id
                return (
                  <button key={g.id} type="button" role="radio" aria-checked={on}
                    onClick={() => update({ scope: g.id === 'personal' ? null : g.id, src: null, cur: null })}
                    className={CHIP_BUTTON}>
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="min-w-0 lg:w-[26rem]">
          <ControlLabel>{t('reports.period')}</ControlLabel>
          <SegmentedControl label={t('reports.period')} value={preset}
            onChange={(v) => update({ period: v === 'last6' ? null : v })}
            options={PRESETS.map((p) => ({ value: p, label: t(`reports.${p}`) }))} />
        </div>
      </div>

      {waitingGroup ? <FullScreenSpinner /> : groupsFailed ? <QueryError onRetry={() => void groupsQuery.refetch()} /> : group ? (
        <GroupReport key={group.id} group={group} period={period} locale={locale} />
      ) : (
        <PersonalReport period={period} locale={locale} src={params.get('src')} cur={params.get('cur')}
          onSource={(src) => update({ src: src || null })} onCurrency={(cur) => update({ cur, src: null })} />
      )}
    </section>
  )
}

function PersonalReport({ period, locale, src, cur, onSource, onCurrency }: {
  period: Period
  locale: string
  src: string | null
  cur: string | null
  onSource: (v: string) => void
  onCurrency: (v: string) => void
}) {
  const { t } = useTranslation()
  const hidden = useHideValues()
  const chartLabel = useChartLabel()
  const entriesQuery = useEntriesRange(period.from, period.to)
  const accountsQuery = useAccounts()
  const cardsQuery = useCards()
  const categoriesQuery = useCategories()

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const currencies = useMemo(() => currenciesOf(entries), [entries])
  const currency = cur && currencies.includes(cur) ? cur : currencies[0] ?? ''
  const { format, formatTick } = useMoneyFormats(currency || 'BRL', locale)

  // Contas e cartões na moeda; arquivados só se tiverem lançamentos no período.
  const sources = useMemo(() => {
    const used = new Set(entries.filter((e) => e.currency === currency).flatMap((e) => [e.account_id, e.card_id]))
    const accounts = (accountsQuery.data ?? []).filter((a) => a.currency === currency && (!a.archived || used.has(a.id)))
    const cards = (cardsQuery.data ?? []).filter((c) => c.currency === currency && (!c.archived || used.has(c.id)))
    return [
      ...accounts.map((a) => ({ value: `a:${a.id}`, label: a.name })),
      ...cards.map((c) => ({ value: `k:${c.id}`, label: c.name })),
    ]
  }, [entries, currency, accountsQuery.data, cardsQuery.data])
  const source = src && sources.some((s) => s.value === src) ? src : ''

  const filtered = useMemo(() => entries.filter((e) => {
    if (e.currency !== currency) return false
    if (source.startsWith('a:')) return e.account_id === source.slice(2)
    if (source.startsWith('k:')) return e.card_id === source.slice(2)
    return true
  }), [entries, currency, source])

  const monthly = useMemo(() => monthlyTotals(filtered, period.months, currency), [filtered, period.months, currency])
  const categoriesById = useMemo(() => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])), [categoriesQuery.data])
  const categories = useMemo<CategoryItem[]>(() => categoryTotals(filtered, currency).map((c) => {
    const cat = categoriesById.get(c.category_id)
    return {
      id: c.category_id, amount: c.amount, share: c.share,
      label: cat ? categoryLabel(cat, t) : t('common.other'), icon: cat?.icon ?? 'tag', color: cat?.color ?? 'var(--muted)',
    }
  }), [filtered, currency, categoriesById, t])

  const pending = entriesQuery.isPending || accountsQuery.isPending || cardsQuery.isPending || categoriesQuery.isPending
  const error = entriesQuery.isError || accountsQuery.isError || cardsQuery.isError || categoriesQuery.isError
  if (pending) return <Loading />
  if (error) {
    return <QueryError onRetry={() => {
      void entriesQuery.refetch(); void accountsQuery.refetch(); void cardsQuery.refetch(); void categoriesQuery.refetch()
    }} />
  }
  if (entries.length === 0) return <EmptyState icon={ChartColumn} title={t('reports.empty')} />

  const income = monthly.reduce((s, m) => s + m.income, 0)
  const expense = monthly.reduce((s, m) => s + m.expense, 0)
  const balance = income - expense
  const avg = Math.round(expense / Math.max(1, period.months.length))
  const series: BarSeries[] = [
    { name: t('reports.income'), color: 'var(--income)', values: monthly.map((m) => m.income) },
    { name: t('reports.expense'), color: 'var(--expense)', values: monthly.map((m) => m.expense) },
  ]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        <SelectField label={t('reports.source')} value={source} onChange={(e) => onSource(e.target.value)}>
          <option value="">{t('reports.allSources')}</option>
          {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </SelectField>
        {currencies.length > 1 && (
          <div className="min-w-0">
            <ControlLabel>{t('accounts.currency')}</ControlLabel>
            <SegmentedControl label={t('accounts.currency')} value={currency} onChange={onCurrency}
              options={currencies.map((c) => ({ value: c, label: c }))} />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Panel><p className="py-6 text-center text-[15px] font-semibold text-muted">{t('reports.empty')}</p></Panel>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <Panel>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Tile label={t('reports.income')}>
                  <Amount cents={income} currency={currency} locale={locale} className="text-success" />
                </Tile>
                <Tile label={t('reports.expense')}>
                  <Amount cents={expense} currency={currency} locale={locale} />
                </Tile>
                <Tile label={t('reports.balance')}>
                  <Amount cents={balance} currency={currency} locale={locale}
                    className={balance > 0 ? 'text-success' : balance < 0 ? 'text-danger' : ''} />
                </Tile>
                <Tile label={t('reports.avgExpense')}>
                  <Amount cents={avg} currency={currency} locale={locale} />
                </Tile>
              </div>
            </Panel>
            <Panel title={t('reports.incomeVsExpense')}>
              <BarChart labels={period.labels} titles={period.titles} series={series} format={format} formatTick={formatTick}
                hidden={hidden} ariaLabel={chartLabel(t('reports.incomeVsExpense'))} />
            </Panel>
          </div>
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <Panel title={t('reports.byCategory')}>
              <CategoryBreakdown items={categories} currency={currency} locale={locale} />
            </Panel>
          </div>
        </div>
      )}
    </>
  )
}

function GroupReport({ group, period, locale }: { group: Group; period: Period; locale: string }) {
  const { t } = useTranslation()
  const hidden = useHideValues()
  const { user } = useAuth()
  const myId = user?.id
  const membersQuery = useGroupMembers(group.id)
  const chartLabel = useChartLabel()
  const entriesQuery = useGroupPeriodEntries(group.id, period.from, period.to)
  const { format, formatTick } = useMoneyFormats(group.currency, locale)

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const entries = useMemo(
    () => (entriesQuery.data ?? []).filter((e) => e.currency === group.currency),
    [entriesQuery.data, group.currency],
  )
  const stats = useMemo(() => groupMonthStats(entries, members), [entries, members])

  const categories = useMemo<CategoryItem[]>(() => stats.byCategory.map((c) => ({
    id: c.category_id, amount: c.amount, icon: c.icon, color: c.color,
    share: stats.total > 0 ? Math.round((c.amount * 100) / stats.total) : 0,
    label: categoryLabel({ name: c.name, i18n_key: c.key }, t),
  })), [stats, t])

  // A cor segue a pessoa (posição na lista de membros): trocar 3→12 meses não repinta ninguém.
  const colorOf = useMemo(() => memberColorOf(members), [members])

  // Uma série por membro que gastou (até 6; os demais somados em "Outros"), na ordem da lista de membros.
  const series = useMemo<BarSeries[]>(() => {
    const spenders = memberMonthly(entries, period.months, group.currency)
    const overflow = spenders.length > MAX_SERIES
    const top = overflow ? spenders.slice(0, MAX_SERIES - 1) : spenders
    const position = (id: string) => members.findIndex((m) => m.user_id === id)
    const named: BarSeries[] = [...top].sort((a, b) => position(a.user_id) - position(b.user_id)).map((s) => {
      const member = members.find((m) => m.user_id === s.user_id)
      return {
        id: s.user_id,
        name: member ? memberDisplayName(member, myId, t) : t('groups.unnamed'),
        color: colorOf(s.user_id),
        values: s.values,
      }
    })
    if (overflow) {
      const rest = spenders.slice(MAX_SERIES - 1)
      named.push({
        id: 'other',
        name: t('common.other'),
        color: 'var(--muted)',
        values: period.months.map((_, i) => rest.reduce((sum, r) => sum + r.values[i], 0)),
      })
    }
    return named
  }, [entries, period.months, group.currency, members, myId, t, colorOf])

  if (membersQuery.isPending || entriesQuery.isPending) return <Loading />
  if (membersQuery.isError || entriesQuery.isError) {
    return <QueryError onRetry={() => { void membersQuery.refetch(); void entriesQuery.refetch() }} />
  }
  if (stats.total === 0) return <EmptyState icon={ChartColumn} title={t('reports.empty')} />

  const avg = Math.round(stats.total / Math.max(1, period.months.length))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
        <Panel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Tile label={t('reports.expense')}>
              <Amount cents={stats.total} currency={group.currency} locale={locale} />
            </Tile>
            <Tile label={t('reports.avgExpense')}>
              <Amount cents={avg} currency={group.currency} locale={locale} />
            </Tile>
          </div>
        </Panel>
        <Panel title={t('reports.memberComparison')}>
          <BarChart labels={period.labels} titles={period.titles} series={series} format={format} formatTick={formatTick}
            hidden={hidden} ariaLabel={chartLabel(t('reports.memberComparison'))} />
        </Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
        <Panel title={t('reports.byMember')}>
          <MemberShares members={stats.byMember} myId={myId} currency={group.currency} locale={locale} colorOf={colorOf} />
        </Panel>
        <Panel title={t('reports.byCategory')}>
          <CategoryBreakdown items={categories} currency={group.currency} locale={locale} />
        </Panel>
      </div>
    </div>
  )
}
