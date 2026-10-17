import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ReceiptText, Settings2, UserPlus, Users } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Button } from '../../components/ui/Button'
import { Card, RowItem, RowList, SectionHeader } from '../../components/ui/Card'
import { HERO_NUMBER, HeroCard } from '../../components/ui/HeroCard'
import { SegmentedRing } from '../../components/ui/SegmentedRing'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { dateFromISO, isMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAuth } from '../auth/auth-context'
import { categoryLabel } from '../categories/label'
import { useGroupEntries, useGroupMembers, useMyGroups, useRemoveMember, useTransferAdmin } from './api'
import { memberColorOf, memberDisplayName, splitAtSlot } from './display'
import { GroupBudgetSection } from './GroupBudgetSection'
import { GroupIcon } from './GroupIcon'
import { GroupSettingsSheet } from './GroupSettingsSheet'
import { InviteSheet } from './InviteSheet'
import { MemberRow } from './MemberRow'
import { MemberShares } from './MemberShares'
import { groupMonthStats } from './stats'
import type { GroupEntry } from './types'

const AMOUNT_SLOT = '⁣AMOUNT⁣'

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {children}
    </Card>
  )
}

function Loading() {
  return <div className="grid place-items-center py-8 text-primary"><Spinner /></div>
}

const byDateDesc = (a: GroupEntry, b: GroupEntry) =>
  b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)

export default function GroupDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const { user } = useAuth()
  const myId = user?.id
  const [params, setParams] = useSearchParams()
  // Acabou de entrar pelo convite.
  const joined = (useLocation().state as { joined?: boolean } | null)?.joined === true
  const raw = params.get('m')
  const month = isMonth(raw) ? raw : monthOf(todayISO())

  const groupsQuery = useMyGroups()
  const group = groupsQuery.data?.find((g) => g.id === id)
  const membersQuery = useGroupMembers(group ? id : undefined)
  const entriesQuery = useGroupEntries(group ? id : undefined, month)
  const transfer = useTransferAdmin()
  const remove = useRemoveMember()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const entries = useMemo(() => [...(entriesQuery.data ?? [])].sort(byDateDesc), [entriesQuery.data])
  const stats = useMemo(() => groupMonthStats(entries, members), [entries, members])
  const colorOf = useMemo(() => memberColorOf(members), [members])
  const namesById = useMemo(
    () => new Map(members.map((m) => [m.user_id, memberDisplayName(m, myId, t)])),
    [members, myId, t],
  )

  if (groupsQuery.isPending) return <div className="min-h-[40vh]"><FullScreenSpinner /></div>
  if (groupsQuery.isError) return <QueryError onRetry={() => void groupsQuery.refetch()} />
  // Saiu ou excluiu: o grupo some do cache e a tela vai direto para a lista, sem "não encontrado".
  if (!group && leaving) return <Navigate to="/groups" replace />
  if (!group) {
    return (
      <EmptyState icon={Users} title={t('groups.notFound')}
        action={<Link to="/groups" className="mt-1 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-ink-fg hover:bg-ink-hover">{t('groups.title')}</Link>} />
    )
  }

  const admin = group.role === 'admin'
  const mine = stats.byMember.find((m) => m.user_id === myId)
  const [beforeAmount, afterAmount] = splitAtSlot(t('groups.yourPart', { amount: AMOUNT_SLOT, pct: mine?.share ?? 0 }), AMOUNT_SLOT)
  const dataPending = membersQuery.isPending || entriesQuery.isPending
  const dataError = membersQuery.isError || entriesQuery.isError
  const retry = () => { void membersQuery.refetch(); void entriesQuery.refetch() }
  const shortDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(dateFromISO(iso))
  const nameOf = (userId: string) => namesById.get(userId) ?? t('groups.unnamed')

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/groups" className="inline-flex h-11 items-center gap-1 rounded-full pr-3 text-sm font-bold text-muted hover:text-fg">
          <ChevronLeft className="size-5" aria-hidden="true" /> {t('common.back')}
        </Link>
        <div className="flex items-center gap-2">
          {admin && (
            <Button className="h-11 px-5" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" aria-hidden="true" /> {t('groups.invite')}
            </Button>
          )}
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label={t('groups.settings')}
            className="grid size-11 place-items-center rounded-full bg-surface text-fg transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
            <Settings2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <header className="flex items-center gap-4">
        <GroupIcon name={group.icon} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-[30px] font-extrabold leading-tight tracking-[-0.035em] lg:text-[34px]">{group.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] font-medium text-muted">
            {t('groups.members', { count: group.members })}
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-muted">{group.currency}</span>
          </p>
        </div>
      </header>

      {joined && <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{t('groups.join.joined')}</p>}

      <div className="sm:max-w-md">
        <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Resumo */}
          {dataPending ? <Card><Loading /></Card> : dataError ? <QueryError onRetry={retry} /> : (
            <HeroCard
              value={<Amount cents={stats.total} currency={group.currency} locale={locale} smallSymbol className={HERO_NUMBER} />}
              label={t('groups.monthTotal')}
              detail={
                <p className="mt-1 text-[13px] font-semibold text-muted">
                  {beforeAmount}
                  <Amount cents={mine?.amount ?? 0} currency={group.currency} locale={locale} className="font-bold text-fg" />
                  {afterAmount}
                </p>
              }
              ring={
                <SegmentedRing size={100} stroke={11} ariaLabel={t('groups.memberRing')}
                  segments={stats.byMember.map((m) => ({ key: m.user_id, value: m.amount, color: colorOf(m.user_id) }))}>
                  <Users className="size-7 text-muted" aria-hidden="true" />
                </SegmentedRing>
              } />
          )}

          {/* Quem gastou quanto */}
          <Panel title={t('groups.byMember')}>
            {dataPending ? <Loading /> : dataError ? <QueryError onRetry={retry} /> : (
              <MemberShares members={stats.byMember} myId={myId} currency={group.currency} locale={locale} colorOf={colorOf} />
            )}
          </Panel>

          {/* Por categoria */}
          <Panel title={t('groups.byCategory')}>
            {dataPending ? <Loading /> : dataError ? <QueryError onRetry={retry} /> : stats.byCategory.length === 0 ? (
              <p className="py-2 text-sm font-medium text-muted">{t('groups.entriesEmpty')}</p>
            ) : (
              <>
                <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-ring-track" aria-hidden="true">
                  {stats.byCategory.map((c) => (
                    <div key={c.category_id} className="h-full"
                      style={{ width: `${stats.total > 0 ? (c.amount / stats.total) * 100 : 0}%`, backgroundColor: c.color }} />
                  ))}
                </div>
                <ul className="flex flex-col gap-1">
                  {stats.byCategory.map((c) => {
                    const pct = stats.total > 0 ? Math.round((c.amount / stats.total) * 100) : 0
                    return (
                      <li key={c.category_id} className="flex items-center gap-3.5 py-1.5">
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold">{categoryLabel({ name: c.name, i18n_key: c.key }, t)}</span>
                          <span className="block text-[13px] font-medium text-muted">{t('groups.share', { pct })}</span>
                        </span>
                        <Amount cents={c.amount} currency={group.currency} locale={locale} className="shrink-0 text-[15px] font-bold" />
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Panel>

          {/* Orçamento do grupo */}
          <GroupBudgetSection group={group} month={month} admin={admin} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* Lançamentos do grupo */}
          <section aria-labelledby="group-entries">
            <SectionHeader id="group-entries" title={t('groups.entries')} />
            {dataPending ? <Loading /> : dataError ? <QueryError onRetry={retry} /> : entries.length === 0 ? (
              <EmptyState icon={ReceiptText} title={t('groups.entriesEmpty')} description={t('groups.entriesHint')} />
            ) : (
              <RowList>
                {entries.map((e) => {
                  const label = categoryLabel({ name: e.category_name, i18n_key: e.category_key }, t)
                  const meta = [nameOf(e.user_id), shortDate(e.date)]
                  if (e.is_card) meta.push(t('transactions.card'))
                  if (e.installments_count > 1) meta.push(`${e.installment_number}/${e.installments_count}`)
                  const content = (
                    <>
                      <CategoryIcon icon={e.category_icon} color={e.category_color} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">{e.description || label}</span>
                        <span className="block truncate text-[13px] font-medium text-muted">{meta.join(' · ')}</span>
                      </span>
                      <Amount cents={e.amount} currency={e.currency} locale={locale} sign={e.kind}
                        className={`shrink-0 text-[15px] font-bold ${e.kind === 'income' ? 'text-success' : 'text-fg'}`} />
                    </>
                  )
                  const row = 'flex items-center gap-3.5 px-3.5 py-3'
                  return (
                    <RowItem key={e.entry_id}>
                      {e.user_id === myId ? (
                        <Link to={`/transactions/${e.transaction_id}/edit`}
                          className={`${row} transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary`}>
                          {content}
                        </Link>
                      ) : (
                        <div className={row}>{content}</div>
                      )}
                    </RowItem>
                  )
                })}
              </RowList>
            )}
          </section>

          {/* Membros */}
          <section aria-labelledby="group-members" className="rounded-card bg-surface p-3 sm:p-4">
            <div className="px-2"><SectionHeader id="group-members" title={t('groups.membersTitle')} /></div>
            {membersQuery.isPending ? <Loading /> : membersQuery.isError ? (
              <div className="p-3"><QueryError onRetry={() => void membersQuery.refetch()} /></div>
            ) : (
              <ul className="flex flex-col">
                {members.map((m) => (
                  <li key={m.user_id}>
                    <MemberRow member={m} displayName={memberDisplayName(m, myId, t)}
                      manageable={admin && m.user_id !== myId && m.left_at === null}
                      busy={transfer.isPending || remove.isPending}
                      onMakeAdmin={() => transfer.mutateAsync({ groupId: group.id, userId: m.user_id })}
                      onRemove={() => remove.mutateAsync({ groupId: group.id, userId: m.user_id })} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="px-2 text-xs text-muted">{t('groups.privacyNote')}</p>

      {admin && <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} group={group} />}
      <GroupSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} group={group} onLeaving={setLeaving} />
    </section>
  )
}
