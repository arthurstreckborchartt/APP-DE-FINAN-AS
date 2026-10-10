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
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left
            enabled:hover:bg-surface-2 disabled:cursor-default">
          <CategoryIcon icon={c.icon} color={c.color} />
          <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel(c, t)}</span>
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
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('categories.title')}</h1>
        <Button className="h-10" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('categories.new')}
        </Button>
      </div>

      <div className="mt-6">
        <SegmentedControl label={t('categories.title')} value={kind} onChange={setKind}
          options={[
            { value: 'expense', label: t('categories.expense') },
            { value: 'income', label: t('categories.income') },
          ]} />
      </div>

      <p className="mt-3 text-xs text-muted">{t('categories.systemHint')}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{active.map(item)}</ul>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer py-2 text-sm font-medium text-muted">{t('categories.archivedSection')}</summary>
          <ul className="mt-2 grid gap-2 opacity-70 sm:grid-cols-2">{archived.map(item)}</ul>
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
