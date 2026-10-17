import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { Spinner } from '../../components/ui/Spinner'
import { normalizeLocale } from '../../lib/locale'
import { useGroupBudgets } from '../budgets/api'
import { BudgetForm } from '../budgets/BudgetForm'
import { BudgetRow } from '../budgets/BudgetRow'
import { budgetsWithSpent } from '../budgets/rows'
import type { Budget } from '../budgets/types'
import { useCategories } from '../categories/api'
import { useGroupEntries } from './api'
import type { Group } from './types'

type Props = { group: Group; month: string; admin: boolean }

/** Orçamento do grupo: todos veem; só o administrador cria e edita. */
export function GroupBudgetSection({ group, month, admin }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const budgetsQuery = useGroupBudgets(group.id)
  const entriesQuery = useGroupEntries(group.id, month)
  const categoriesQuery = useCategories()
  const [editing, setEditing] = useState<Budget | 'new' | null>(null)

  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data])
  const categoriesById = useMemo(() => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])), [categoriesQuery.data])
  const rows = useMemo(() => budgetsWithSpent(budgets, entriesQuery.data ?? [], group.currency), [budgets, entriesQuery.data, group.currency])

  const pending = budgetsQuery.isPending || entriesQuery.isPending || categoriesQuery.isPending
  const error = budgetsQuery.isError || entriesQuery.isError || categoriesQuery.isError
  const retry = () => { void budgetsQuery.refetch(); void entriesQuery.refetch(); void categoriesQuery.refetch() }
  const newButton = (className = 'h-10') => (
    <Button className={`${className} shrink-0 whitespace-nowrap`} onClick={() => setEditing('new')}>
      <Plus className="size-4" aria-hidden="true" /> {t('budgets.new')}
    </Button>
  )

  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-sheet sm:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-[17px] font-extrabold tracking-[-0.01em]">{t('budgets.group')}</h2>
        {admin && rows.length > 0 && newButton()}
      </div>
      <p className="mb-4 text-[13px] font-medium text-muted">{t('budgets.groupHint')}</p>
      {pending ? (
        <div className="grid place-items-center py-8 text-primary"><Spinner /></div>
      ) : error ? (
        <QueryError onRetry={retry} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm font-medium text-muted">{t(admin ? 'budgets.groupEmptyAdmin' : 'budgets.groupEmpty')}</p>
          {admin && newButton()}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.budget.id}>
              <BudgetRow category={categoriesById.get(r.budget.category_id)} spent={r.spent} limit={r.budget.amount}
                currency={group.currency} locale={locale} onClick={admin ? () => setEditing(r.budget) : undefined} />
            </li>
          ))}
        </ul>
      )}

      {admin && (
        <Sheet open={editing !== null} onClose={() => setEditing(null)}
          title={editing === 'new' ? t('budgets.new') : t('budgets.edit')}>
          {editing && categoriesQuery.data && (
            <BudgetForm key={editing === 'new' ? 'new' : editing.id} mode="group" groupId={group.id}
              currency={group.currency} budget={editing === 'new' ? undefined : editing} existing={budgets}
              categories={categoriesQuery.data} onDone={() => setEditing(null)} />
          )}
        </Sheet>
      )}
    </section>
  )
}
