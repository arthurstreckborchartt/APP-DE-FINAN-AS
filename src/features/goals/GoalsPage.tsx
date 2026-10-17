import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PiggyBank, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useProfile } from '../profile/api'
import { useGoals } from './api'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import { GoalSheet } from './GoalSheet'
import type { Goal } from './types'

type Open = { kind: 'new' } | { kind: 'view' | 'edit'; id: string } | null

export default function GoalsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const today = todayISO()
  const { data: profile } = useProfile()
  const { data: goals, isPending, isError, refetch } = useGoals()
  const [open, setOpen] = useState<Open>(null)

  if (isPending) return <FullScreenSpinner />
  if (isError || !goals) return <QueryError onRetry={() => void refetch()} />

  const active = goals.filter((g) => !g.archived)
  const archived = goals.filter((g) => g.archived)
  // A meta aberta vem sempre da lista atual (reflete aportes e edições; some se foi excluída).
  const current = open && open.kind !== 'new' ? goals.find((g) => g.id === open.id) : undefined
  const sheetOpen = open?.kind === 'new' || !!current
  const close = () => setOpen(null)

  const grid = (list: Goal[]) => (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      {list.map((g) => (
        <li key={g.id}>
          <GoalCard goal={g} locale={locale} today={today} onClick={() => setOpen({ kind: 'view', id: g.id })} />
        </li>
      ))}
    </ul>
  )

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('goals.title')}</h1>
          <p className="mt-1 text-[15px] font-medium text-muted">{t('goals.subtitle')}</p>
        </div>
        {goals.length > 0 && (
          <Button className="h-11" onClick={() => setOpen({ kind: 'new' })}>
            <Plus className="size-5" aria-hidden="true" /> {t('goals.new')}
          </Button>
        )}
      </div>

      {active.length === 0 ? (
        <EmptyState icon={PiggyBank} title={t('goals.empty')} description={t('goals.emptyBody')}
          action={<Button className="h-10" onClick={() => setOpen({ kind: 'new' })}>{t('goals.new')}</Button>} />
      ) : grid(active)}

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer rounded-full px-2 py-2 text-sm font-bold text-muted">{t('goals.archived')}</summary>
          <div className="mt-2 opacity-75">{grid(archived)}</div>
        </details>
      )}

      <Sheet open={sheetOpen} onClose={close}
        title={open?.kind === 'new' ? t('goals.new') : open?.kind === 'edit' ? t('goals.edit') : current?.name ?? ''}>
        {open?.kind === 'new' && (
          <GoalForm key="new" currency={profile?.currency ?? 'BRL'} onDone={close} />
        )}
        {open?.kind === 'edit' && current && (
          <GoalForm key={current.id} goal={current} currency={current.currency}
            onDone={() => setOpen({ kind: 'view', id: current.id })} />
        )}
        {open?.kind === 'view' && current && (
          <GoalSheet key={current.id} goal={current} locale={locale} today={today}
            onEdit={() => setOpen({ kind: 'edit', id: current.id })} onDeleted={close} />
        )}
      </Sheet>
    </section>
  )
}
