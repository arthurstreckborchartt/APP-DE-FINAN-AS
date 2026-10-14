import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Plus, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { useProfile } from '../profile/api'
import { useCreateGroup, useMyGroups } from './api'
import { GroupForm } from './GroupForm'
import { GroupIcon } from './GroupIcon'
import type { GroupInput } from './types'

export default function GroupsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: groups, isPending, isError, refetch } = useMyGroups()
  const create = useCreateGroup()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isPending) return <FullScreenSpinner />
  if (isError || !groups) return <QueryError onRetry={() => void refetch()} />

  function show() {
    setError(null)
    setOpen(true)
  }

  async function save(value: GroupInput) {
    if (create.isPending) return
    setError(null)
    try {
      const id = await create.mutateAsync(value)
      setOpen(false)
      navigate(`/groups/${id}`)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('groups.title')}</h1>
          <p className="mt-1 max-w-xl text-[15px] text-muted">{t('groups.subtitle')}</p>
        </div>
        <Button className="h-11 shrink-0" onClick={show}>
          <Plus className="size-5" aria-hidden="true" /> {t('groups.new')}
        </Button>
      </div>

      <div className="mt-6">
        {groups.length === 0 ? (
          <EmptyState icon={Users} title={t('groups.empty')} description={t('groups.emptyBody')}
            action={<Button className="h-10" onClick={show}>{t('groups.new')}</Button>} />
        ) : (
          <ul className="flex flex-col rounded-[24px] bg-surface p-2 shadow-sheet">
            {groups.map((g) => (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`}
                  className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 transition hover:bg-surface-2">
                  <GroupIcon name={g.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{g.name}</span>
                    <span className="block text-[13px] font-medium text-muted">{t('groups.members', { count: g.members })}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {g.role === 'admin' && (
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{t('groups.admin')}</span>
                    )}
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">{g.currency}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 px-2 text-xs text-muted">{t('groups.privacyNote')}</p>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('groups.new')}>
        {open && (
          <GroupForm
            initial={{ name: '', currency: profile?.currency ?? 'BRL', icon: 'users' }}
            submitLabel={t('groups.create')}
            loading={create.isPending}
            error={error}
            onSubmit={(v) => void save(v)}
          />
        )}
      </Sheet>
    </section>
  )
}
