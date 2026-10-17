import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { Spinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, MAX_AMOUNT_CENTS, parseAmount } from '../../lib/amount'
import { dateFromISO } from '../../lib/dates'
import { isRpcHint } from '../../lib/db-errors'
import { ConfirmPanel } from '../groups/ConfirmPanel'
import { useAddContribution, useDeleteContribution, useDeleteGoal, useGoalContributions, useUpdateGoal } from './api'
import { GoalProgress } from './GoalCard'
import type { Goal, GoalContribution } from './types'

const errorKey = (e: unknown) => (isRpcHint(e, 'goal_negative') ? 'goals.negative' : 'common.errorGeneric')

type Props = {
  goal: Goal
  locale: string
  today: string
  onEdit: () => void
  /** Depois de excluir a meta. */
  onDeleted: () => void
}

type Kind = 'deposit' | 'withdraw'

function ContributionForm({ goal, kind, locale, today, onDone }: {
  goal: Goal; kind: Kind; locale: string; today: string; onDone: () => void
}) {
  const { t } = useTranslation()
  const add = useAddContribution()
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState<string>()
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (add.isPending) return
    setError(null)
    const cents = parseAmount(amountText)
    if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS) return setAmountError(t('goals.invalidAmount'))
    try {
      await add.mutateAsync({
        goal_id: goal.id, amount: kind === 'withdraw' ? -cents : cents, date: date || today, note: note.trim(),
      })
      onDone()
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-label={t(kind === 'deposit' ? 'goals.deposit' : 'goals.withdraw')}
      className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`${t('goals.contributionAmount')} (${goal.currency})`} inputMode="decimal" autoFocus
          placeholder={formatAmountPlain(0, locale)} value={amountText} error={amountError}
          onChange={(e) => { setAmountText(e.target.value); setAmountError(undefined) }} />
        <TextField label={t('goals.contributionDate')} type="date" min="2000-01-01" max="2100-12-31"
          value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <TextField label={t('goals.note')} maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" disabled={add.isPending} onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={add.isPending}>
          {t(kind === 'deposit' ? 'goals.deposit' : 'goals.withdraw')}
        </Button>
      </div>
    </form>
  )
}

function History({ goal, locale }: { goal: Goal; locale: string }) {
  const { t } = useTranslation()
  const query = useGoalContributions(goal.id)
  const remove = useDeleteContribution()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  async function destroy(c: GoalContribution) {
    setError(null)
    try {
      await remove.mutateAsync(c.id)
      setConfirming(null)
    } catch (err) {
      setConfirming(null)
      setError(t(errorKey(err)))
    }
  }

  return (
    <section aria-labelledby="goal-history">
      <h3 id="goal-history" className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">{t('goals.history')}</h3>
      {error && <p role="alert" className="mt-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      {query.isPending ? (
        <div className="grid place-items-center py-6 text-primary"><Spinner /></div>
      ) : query.isError ? (
        <div className="mt-2"><QueryError onRetry={() => void query.refetch()} /></div>
      ) : query.data.length === 0 ? (
        <p className="mt-2 text-sm font-medium text-muted">{t('goals.historyEmpty')}</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {query.data.map((c) => (
            <li key={c.id} className="py-1">
              {confirming === c.id ? (
                <ConfirmPanel message={t('goals.deleteContributionConfirm')} confirmLabel={t('goals.deleteContribution')}
                  danger loading={remove.isPending} onConfirm={() => void destroy(c)} onCancel={() => setConfirming(null)} />
              ) : (
                <div className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{dayFmt.format(dateFromISO(c.date))}</span>
                    {c.note && <span className="block truncate text-[13px] font-medium text-muted">{c.note}</span>}
                  </span>
                  <Amount cents={Math.abs(c.amount)} currency={goal.currency} locale={locale}
                    sign={c.amount > 0 ? 'income' : 'expense'}
                    className={`shrink-0 whitespace-nowrap text-[15px] font-extrabold ${c.amount > 0 ? 'text-success' : ''}`} />
                  <button type="button" aria-label={t('goals.deleteContribution')} disabled={remove.isPending}
                    onClick={() => { setError(null); setConfirming(c.id) }}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-danger
                      focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Detalhe da meta: guardar/retirar, histórico de aportes e ações. */
export function GoalSheet({ goal, locale, today, onEdit, onDeleted }: Props) {
  const { t } = useTranslation()
  const update = useUpdateGoal()
  const remove = useDeleteGoal()
  const [kind, setKind] = useState<Kind | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || remove.isPending

  async function toggleArchive() {
    setError(null)
    try {
      await update.mutateAsync({ id: goal.id, patch: { archived: !goal.archived } })
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function destroy() {
    setError(null)
    try {
      await remove.mutateAsync(goal.id)
      onDeleted()
    } catch {
      setConfirmDelete(false)
      setError(t('common.errorGeneric'))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-surface-2 p-4">
        {goal.archived && (
          <span className="mb-3 inline-block rounded-full bg-surface px-2.5 py-1 text-[12px] font-extrabold text-muted">{t('common.archived')}</span>
        )}
        <div className="flex items-start gap-3">
          <CategoryIcon icon={goal.icon} color={goal.color} size="sm" />
          <span className="min-w-0 flex-1">
            <GoalProgress goal={goal} locale={locale} today={today} track="bg-surface" />
          </span>
        </div>
      </div>

      {kind ? (
        <ContributionForm key={kind} goal={goal} kind={kind} locale={locale} today={today} onDone={() => setKind(null)} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => setKind('deposit')}>
            <Plus className="size-5" aria-hidden="true" /> {t('goals.deposit')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setKind('withdraw')}>
            <Minus className="size-5" aria-hidden="true" /> {t('goals.withdraw')}
          </Button>
        </div>
      )}

      <p className="text-[13px] font-medium text-muted">{t('goals.manualHint')}</p>

      <History goal={goal} locale={locale} />

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" className="px-4" disabled={busy} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" /> {t('common.edit')}
          </Button>
          <Button type="button" variant="secondary" className="whitespace-nowrap px-4" loading={update.isPending} disabled={busy} onClick={() => void toggleArchive()}>
            {goal.archived
              ? <><ArchiveRestore className="size-4" aria-hidden="true" /> {t('goals.unarchive')}</>
              : <><Archive className="size-4" aria-hidden="true" /> {t('goals.archive')}</>}
          </Button>
        </div>
        {confirmDelete ? (
          <ConfirmPanel message={t('goals.deleteConfirm')} confirmLabel={t('goals.delete')} danger loading={remove.isPending}
            onConfirm={() => void destroy()} onCancel={() => setConfirmDelete(false)} />
        ) : (
          <Button type="button" variant="danger" full disabled={busy} onClick={() => { setError(null); setConfirmDelete(true) }}>
            <Trash2 className="size-4" aria-hidden="true" /> {t('goals.delete')}
          </Button>
        )}
      </div>
    </div>
  )
}
