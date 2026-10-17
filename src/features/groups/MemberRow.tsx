import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EllipsisVertical } from 'lucide-react'
import { ConfirmPanel } from './ConfirmPanel'
import { groupErrorKey } from './display'
import type { GroupMember } from './types'

type Action = 'makeAdmin' | 'remove'

type Props = {
  member: GroupMember
  /** Nome já resolvido ("Você", nome ou "Membro sem nome"). */
  displayName: string
  /** Mostra o menu de administração (admin vendo outro membro ativo). */
  manageable: boolean
  busy: boolean
  onMakeAdmin: () => Promise<void>
  onRemove: () => Promise<void>
}

export function MemberRow({ member, displayName, manageable, busy, onMakeAdmin, onRemove }: Props) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState(false)
  const [pending, setPending] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const left = member.left_at !== null
  const initial = (member.name.trim() || displayName).charAt(0).toUpperCase()

  async function run() {
    if (!pending) return
    setError(null)
    try {
      await (pending === 'makeAdmin' ? onMakeAdmin() : onRemove())
      setPending(null)
      setMenu(false)
    } catch (e) {
      // A confirmação continua aberta, com o erro logo abaixo.
      setError(t(groupErrorKey(e)))
    }
  }

  return (
    <div className="py-1">
      <div className="flex items-center gap-3.5 rounded-[18px] px-2 py-1.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg text-[15px] font-extrabold text-fg dark:bg-surface-2" aria-hidden="true">
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{displayName}</span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {member.role === 'admin' && !left && (
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{t('groups.admin')}</span>
          )}
          {left && <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-muted dark:bg-surface-2">{t('groups.left')}</span>}
        </span>
        {manageable && (
          <button type="button" aria-expanded={menu} aria-label={t('groups.memberOptions', { name: displayName })}
            onClick={() => { setMenu(!menu); setPending(null); setError(null) }}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
            <EllipsisVertical className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {manageable && menu && (
        <div className="mx-2 mb-2">
          {pending ? (
            <ConfirmPanel
              message={t(pending === 'makeAdmin' ? 'groups.makeAdminConfirm' : 'groups.removeConfirm', { name: displayName })}
              confirmLabel={t(pending === 'makeAdmin' ? 'groups.makeAdmin' : 'groups.remove')}
              danger={pending === 'remove'} loading={busy}
              onConfirm={() => void run()} onCancel={() => { setPending(null); setError(null) }} />
          ) : (
            <div className="flex flex-col rounded-[20px] bg-bg p-1.5 dark:bg-surface-2">
              <button type="button" onClick={() => setPending('makeAdmin')}
                className="h-11 rounded-[14px] px-3 text-left text-sm font-bold transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
                {t('groups.makeAdmin')}
              </button>
              <button type="button" onClick={() => setPending('remove')}
                className="h-11 rounded-[14px] px-3 text-left text-sm font-bold text-danger transition hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-primary">
                {t('groups.remove')}
              </button>
            </div>
          )}
          {error && <p role="alert" className="mt-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
