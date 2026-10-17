import { createElement, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ReceiptText, Settings2, UserPlus, Users } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { dateFromISO, isMonth, monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAuth } from '../auth/auth-context'
import { categoryLabel } from '../categories/label'
import { useGroupEntries, useGroupMembers, useMyGroups, useRemoveMember, useTransferAdmin } from './api'
import { memberDisplayName, splitAtSlot } from './display'
import { groupIconComponent } from './GroupIcon'
import { GroupSettingsSheet } from './GroupSettingsSheet'
import { InviteSheet } from './InviteSheet'
import { MemberRow } from './MemberRow'
import { groupMonthStats } from './stats'
import type { GroupEntry } from './types'

const AMOUNT_SLOT = '⁣AMOUNT⁣'

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-sheet sm:p-6">
      <h2 className="mb-4 text-[17px] font-extrabold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  )
}

function LargeGroupIcon({ name }: { name: string }) {
  return (
    <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
      {createElement(groupIconComponent(name), { className: 'size-7', 'aria-hidden': true })}
    </span>
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
        action={<Link to="/groups" className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-fg">{t('groups.title')}</Link>} />
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
    <section className="flex flex-col gap-5">
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
            className="grid size-11 place-items-center rounded-full bg-surface text-fg shadow-sheet transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
            <Settings2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <header className="flex items-center gap-4">
        <LargeGroupIcon name={group.icon} />
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{group.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] font-medium text-muted">
            {t('groups.members', { count: group.members })}
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">{group.currency}</span>
          </p>
        </div>
      </header>

      <div className="sm:max-w-md">
        <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          {/* Resumo */}
          <section className="rounded-[24px] bg-surface p-5 shadow-sheet sm:p-6">
            <p className="text-[15px] font-semibold text-muted">{t('groups.monthTotal')}</p>
            {dataPending ? <Loading /> : dataError ? <div className="mt-3"><QueryError onRetry={retry} /></div> : (
              <>
                <Amount cents={stats.total} currency={group.currency} locale={locale}
                  className="mt-1 block text-[38px] font-extrabold leading-tight tracking-[-0.03em]" />
                <p className="mt-2 text-[15px] font-semibold text-muted">
                  {beforeAmount}
                  <Amount cents={mine?.amount ?? 0} currency={group.currency} locale={locale} className="font-bold text-fg" />
                  {afterAmount}
                </p>
              </>
            )}
          </section>

          {/* Quem gastou quanto */}
          <Panel title={t('groups.byMember')}>
            {dataPending ? <Loading /> : dataError ? <QueryError onRetry={retry} /> : (
              <ul className="flex flex-col gap-4">
                {stats.byMember.map((m) => {
                  const self = m.user_id === myId
                  return (
                    <li key={m.user_id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[15px] font-bold">{memberDisplayName(m, myId, t)}</span>
                          {m.left && <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">{t('groups.left')}</span>}
                        </span>
                        <Amount cents={m.amount} currency={group.currency} locale={locale} className="shrink-0 text-[15px] font-bold" />
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <div className={`h-full rounded-full ${self ? 'bg-primary' : 'bg-muted'}`} style={{ width: `${m.share}%` }} />
                      </div>
                      <p className="mt-1 text-[13px] font-medium text-muted">{t('groups.share', { pct: m.share })}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* Por categoria */}
          <Panel title={t('groups.byCategory')}>
            {dataPending ? <Loading /> : dataError ? <QueryError onRetry={retry} /> : stats.byCategory.length === 0 ? (
              <p className="py-2 text-sm font-medium text-muted">{t('groups.entriesEmpty')}</p>
            ) : (
              <>
                <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  {stats.byCategory.map((c) => (
                    <div key={c.category_id} className="h-full"
                      style={{ width: `${stats.total > 0 ? (c.amount / stats.total) * 100 : 0}%`, backgroundColor: c.color }} />
                  ))}
                </div>
                <ul className="flex flex-col gap-1">
                  {stats.byCategory.map((c) => {
                    const pct = stats.total > 0 ? Math.round((c.amount / stats.total) * 100) : 0
                    return (
                      <li key={c.category_id} className="flex items-center gap-3.5 py-2">
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
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          {/* Lançamentos do grupo */}
          <section className="rounded-[24px] bg-surface p-2 shadow-sheet sm:p-3">
            <h2 className="px-3 pb-2 pt-3 text-[17px] font-extrabold tracking-[-0.01em] sm:pt-3">{t('groups.entries')}</h2>
            {dataPending ? <Loading /> : dataError ? <div className="p-3"><QueryError onRetry={retry} /></div> : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
                  <ReceiptText className="size-7" aria-hidden="true" />
                </span>
                <p className="text-[15px] font-bold">{t('groups.entriesEmpty')}</p>
                <p className="max-w-sm text-sm text-muted">{t('groups.entriesHint')}</p>
              </div>
            ) : (
              <ul className="flex flex-col">
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
                  const row = 'flex items-center gap-3.5 rounded-2xl px-3 py-3'
                  return (
                    <li key={e.entry_id}>
                      {e.user_id === myId ? (
                        <Link to={`/transactions/${e.transaction_id}/edit`}
                          className={`${row} transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary`}>
                          {content}
                        </Link>
                      ) : (
                        <div className={row}>{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Membros */}
          <section className="rounded-[24px] bg-surface p-2 shadow-sheet sm:p-3">
            <h2 className="px-3 pb-1 pt-3 text-[17px] font-extrabold tracking-[-0.01em]">{t('groups.membersTitle')}</h2>
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
