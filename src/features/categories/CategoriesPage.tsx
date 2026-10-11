import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { CategoryIcon } from '../../components/CategoryIcon'
import { isForeignKeyViolation } from '../../lib/db-errors'
import type { TransactionKind } from '../transactions/types'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './api'
import { CategoryForm } from './CategoryForm'
import { CATEGORY_COLORS } from './icons'
import { categoryLabel } from './label'
import type { Category } from './types'

export default function CategoriesPage() {
  const { t } = useTranslation()
  const { data: categories, isPending, isError, refetch } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [kind, setKind] = useState<TransactionKind>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isPending) return <FullScreenSpinner />
  if (isError || !categories) return <QueryError onRetry={() => void refetch()} />

  const ofKind = categories.filter((c) => c.kind === kind)
  const active = ofKind.filter((c) => !c.archived)
  const archived = ofKind.filter((c) => c.archived)

  function open(target: Category | 'new') {
    setError(null)
    setConfirmDelete(false)
    setEditing(target)
  }

  async function save(value: { name: string; icon: string; color: string }) {
    setError(null)
    setConfirmDelete(false)
    try {
      if (editing === 'new') await create.mutateAsync({ kind, ...value })
      else if (editing) await update.mutateAsync({ id: editing.id, patch: value })
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function toggleArchive(cat: Category) {
    setError(null)
    setConfirmDelete(false)
    try {
      await update.mutateAsync({ id: cat.id, patch: { archived: !cat.archived } })
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function destroy(cat: Category) {
    setError(null)
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(cat.id)
      setEditing(null)
    } catch (e) {
      setConfirmDelete(false)
      setError(t(isForeignKeyViolation(e) ? 'categories.deleteBlocked' : 'common.errorGeneric'))
    }
  }

  const item = (c: Category) => {
    const system = c.user_id === null
    return (
      <li key={c.id}>
        <button type="button" disabled={system} onClick={() => open(c)}
          className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition
            enabled:hover:bg-surface-2 disabled:cursor-default">
          <CategoryIcon icon={c.icon} color={c.color} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{categoryLabel(c, t)}</span>
          {system && (
            <>
              <Lock className="size-4 text-muted" aria-hidden="true" />
              <span className="sr-only">{t('common.default')}</span>
            </>
          )}
        </button>
      </li>
    )
  }

  const busy = create.isPending || update.isPending || remove.isPending
  const editingCategory = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('categories.title')}</h1>
        <Button className="h-11" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('categories.new')}
        </Button>
      </div>

      <div className="mt-6 sm:max-w-sm">
        <SegmentedControl label={t('transactions.kindFilter')} value={kind} onChange={setKind}
          options={[
            { value: 'expense', label: t('categories.expense') },
            { value: 'income', label: t('categories.income') },
          ]} />
      </div>

      <ul className="mt-5 grid rounded-[24px] bg-surface p-2 shadow-sheet sm:grid-cols-2 sm:gap-x-2">{active.map(item)}</ul>
      <p className="mt-3 flex items-center gap-1.5 px-2 text-[13px] font-medium text-muted">
        <Lock className="size-3.5" aria-hidden="true" /> {t('categories.systemHint')}
      </p>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer rounded-full px-2 py-2 text-sm font-bold text-muted">{t('categories.archivedSection')}</summary>
          <ul className="mt-2 grid rounded-[24px] bg-surface p-2 opacity-75 shadow-sheet sm:grid-cols-2 sm:gap-x-2">{archived.map(item)}</ul>
        </details>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? t('categories.new') : t('categories.edit')}>
        {editing && (
          <CategoryForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new'
              ? { name: '', icon: 'tag', color: CATEGORY_COLORS[6] }
              : { name: editing.name ?? '', icon: editing.icon, color: editing.color }}
            submitLabel={t('common.save')}
            loading={busy}
            error={error}
            onSubmit={(v) => void save(v)}
          >
            {editingCategory && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" loading={update.isPending} disabled={busy} onClick={() => void toggleArchive(editingCategory)}>
                  {editingCategory.archived ? t('common.unarchive') : t('common.archive')}
                </Button>
                <Button type="button" variant="danger" loading={remove.isPending} disabled={busy} onClick={() => void destroy(editingCategory)}>
                  {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
                </Button>
              </div>
            )}
          </CategoryForm>
        )}
      </Sheet>
    </section>
  )
}
