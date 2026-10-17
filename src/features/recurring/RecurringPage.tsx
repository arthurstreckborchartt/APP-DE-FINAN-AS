import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Repeat } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { isRpcHint } from '../../lib/db-errors'
import { dateFromISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAccounts } from '../accounts/api'
import { useCards } from '../cards/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { groupSaveErrorKey } from '../groups/display'
import { useCreateRecurring, useDeleteRecurring, useRecurring, useUpdateRecurring } from './api'
import { RecurringForm } from './RecurringForm'
import type { Recurring, RecurringInput } from './types'

export default function RecurringPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const recurringQuery = useRecurring()
  const accountsQuery = useAccounts()
  const cardsQuery = useCards()
  const categoriesQuery = useCategories()
  const create = useCreateRecurring()
  const update = useUpdateRecurring()
  const remove = useDeleteRecurring()
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const queries = [recurringQuery, accountsQuery, cardsQuery, categoriesQuery]
  if (queries.some((q) => q.isError)) return <QueryError onRetry={() => queries.forEach((q) => void q.refetch())} />
  const items = recurringQuery.data
  const accounts = accountsQuery.data
  const cards = cardsQuery.data
  const categories = categoriesQuery.data
  if (!items || !accounts || !cards || !categories) return <FullScreenSpinner />

  const thisYear = new Date().getFullYear()
  const ended = (r: Recurring) => !!r.end_date && r.end_date < r.next_date
  const sorted = [...items.filter((r) => !r.paused), ...items.filter((r) => r.paused)]

  function frequencyText(r: Recurring) {
    const start = dateFromISO(r.start_date)
    if (r.frequency === 'weekly') {
      return t('recurring.everyWeek', { weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(start) })
    }
    if (r.frequency === 'monthly') return t('recurring.everyMonth', { day: start.getDate() })
    return t('recurring.everyYear', { date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(start) })
  }

  function nextText(r: Recurring) {
    const d = dateFromISO(r.next_date)
    const date = new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'short', ...(d.getFullYear() !== thisYear ? { year: 'numeric' as const } : {}),
    }).format(d)
    return t('recurring.next', { date })
  }

  function open(target: Recurring | 'new') {
    setError(null)
    setConfirmDelete(false)
    setEditing(target)
  }

  function fail(e: unknown) {
    setError(t(isRpcHint(e, 'archived_source') ? 'recurring.archivedSource' : groupSaveErrorKey(e) ?? 'common.errorGeneric'))
  }

  async function save(value: RecurringInput) {
    setError(null)
    setConfirmDelete(false)
    try {
      if (editing === 'new') await create.mutateAsync(value)
      else if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: {
            amount: value.amount, category_id: value.category_id, description: value.description,
            account_id: value.account_id, card_id: value.card_id, frequency: value.frequency, end_date: value.end_date,
            group_id: value.group_id,
          },
        })
      }
      setEditing(null)
    } catch (e) {
      fail(e)
    }
  }

  async function togglePause(r: Recurring) {
    setError(null)
    setConfirmDelete(false)
    try {
      await update.mutateAsync({ id: r.id, patch: { paused: !r.paused } })
      setEditing(null)
    } catch (e) {
      fail(e)
    }
  }

  async function destroy(r: Recurring) {
    setError(null)
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(r.id)
      setEditing(null)
    } catch {
      setConfirmDelete(false)
      setError(t('common.errorGeneric'))
    }
  }

  const row = (r: Recurring) => {
    const cat = categories.find((c) => c.id === r.category_id)
    const label = cat ? categoryLabel(cat, t) : ''
    const source = accounts.find((a) => a.id === r.account_id)?.name ?? cards.find((c) => c.id === r.card_id)?.name
    const meta = [frequencyText(r), source].filter(Boolean).join(' · ')
    return (
      <li key={r.id}>
        <button type="button" onClick={() => open(r)}
          className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition hover:bg-surface-2">
          {cat && <CategoryIcon icon={cat.icon} color={cat.color} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">{r.description || label}</span>
            <span className="block truncate text-[13px] font-medium text-muted">{meta}</span>
            <span className="mt-1 block">
              {r.paused || ended(r) ? (
                <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-extrabold text-muted">
                  {t(r.paused ? 'recurring.paused' : 'recurring.ended')}
                </span>
              ) : (
                <span className="text-[13px] font-medium text-muted">{nextText(r)}</span>
              )}
            </span>
          </span>
          <Amount cents={r.amount} currency={r.currency} locale={locale} sign={r.kind}
            className={`shrink-0 whitespace-nowrap text-[15px] font-bold ${r.kind === 'income' ? 'text-success' : 'text-fg'}`} />
        </button>
      </li>
    )
  }

  const busy = create.isPending || update.isPending || remove.isPending
  const current = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('recurring.title')}</h1>
        <Button className="h-11 whitespace-nowrap px-4" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('recurring.new')}
        </Button>
      </div>
      <p className="mt-1 text-[15px] font-medium text-muted">{t('recurring.subtitle')}</p>

      <div className="mt-6">
        {sorted.length === 0 ? (
          <EmptyState icon={Repeat} title={t('recurring.empty')} description={t('recurring.emptyBody')}
            action={<Button className="h-10" onClick={() => open('new')}>{t('recurring.new')}</Button>} />
        ) : (
          <ul className="flex flex-col rounded-[24px] bg-surface p-2 shadow-sheet">{sorted.map(row)}</ul>
        )}
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? t('recurring.new') : t('recurring.edit')}>
        {editing && (
          <RecurringForm
            key={editing === 'new' ? 'new' : editing.id}
            recurring={current ?? undefined}
            accounts={accounts} cards={cards} categories={categories}
            loading={create.isPending || update.isPending}
            error={error}
            onSubmit={(v) => void save(v)}
          >
            {current && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" loading={update.isPending} disabled={busy} onClick={() => void togglePause(current)}>
                    {current.paused ? t('recurring.resume') : t('recurring.pause')}
                  </Button>
                  <Button type="button" variant="danger" loading={remove.isPending} disabled={busy} onClick={() => void destroy(current)}>
                    {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
                  </Button>
                </div>
                <p className="text-center text-[13px] font-medium text-muted">{t('recurring.deleteHint')}</p>
              </>
            )}
          </RecurringForm>
        )}
      </Sheet>
    </section>
  )
}
