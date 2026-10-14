import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LogOut, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { TextField } from '../../components/ui/TextField'
import { useDeleteGroup, useLeaveGroup, useUpdateGroup } from './api'
import { ConfirmPanel } from './ConfirmPanel'
import { groupErrorKey } from './display'
import { GROUP_ICON_NAMES, groupIconComponent } from './GroupIcon'
import type { Group } from './types'

type Props = { open: boolean; onClose: () => void; group: Group }

export function GroupSettingsSheet({ open, onClose, group }: Props) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onClose={onClose} title={t('groups.settings')}>
      {open && <SettingsContent group={group} onClose={onClose} />}
    </Sheet>
  )
}

function SettingsContent({ group, onClose }: { group: Group; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdateGroup()
  const remove = useDeleteGroup()
  const leave = useLeaveGroup()
  const admin = group.role === 'admin'
  const [name, setName] = useState(group.name)
  const [icon, setIcon] = useState(group.icon)
  const [nameError, setNameError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'delete' | 'leave' | 'adminLeave' | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (update.isPending) return
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 40) return setNameError(t('common.errorGeneric'))
    setNameError(undefined)
    setError(null)
    try {
      await update.mutateAsync({ id: group.id, patch: { name: trimmed, icon } })
      onClose()
    } catch (err) {
      setError(t(groupErrorKey(err)))
    }
  }

  async function confirm() {
    setError(null)
    try {
      if (pending === 'delete') await remove.mutateAsync(group.id)
      else if (pending === 'leave') await leave.mutateAsync(group.id)
      else return
      navigate('/groups', { replace: true })
    } catch (err) {
      setError(t(groupErrorKey(err)))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {admin && (
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
          <TextField label={t('groups.name')} required maxLength={40} value={name} error={nameError}
            onChange={(e) => { setName(e.target.value); setNameError(undefined) }} />
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted">{t('groups.icon')}</p>
            <div className="grid grid-cols-5 gap-2">
              {GROUP_ICON_NAMES.map((n) => {
                const Icon = groupIconComponent(n)
                const on = icon === n
                return (
                  <button key={n} type="button" aria-pressed={on} aria-label={n} onClick={() => setIcon(n)}
                    className={`grid h-12 place-items-center rounded-2xl transition ${on ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>
          <Button type="submit" full loading={update.isPending}>{t('groups.save')}</Button>
        </form>
      )}

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}

      <div className={`flex flex-col gap-2 ${admin ? 'border-t border-line pt-4' : ''}`}>
        {pending === 'leave' ? (
          <ConfirmPanel message={t('groups.leaveConfirm')} confirmLabel={t('groups.leave')} danger
            loading={leave.isPending} onConfirm={() => void confirm()} onCancel={() => setPending(null)} />
        ) : pending === 'adminLeave' ? (
          <div role="status" className="rounded-2xl bg-surface-2 p-4">
            <p className="text-sm font-semibold">{t('groups.adminMustTransfer')}</p>
            <Button type="button" variant="ghost" className="mt-3 h-10 bg-surface" onClick={() => setPending(null)}>
              {t('common.close')}
            </Button>
          </div>
        ) : (
          <Button type="button" variant={admin ? 'ghost' : 'danger'} full
            onClick={() => { setError(null); setPending(admin ? 'adminLeave' : 'leave') }}>
            <LogOut className="size-4" aria-hidden="true" /> {t('groups.leave')}
          </Button>
        )}
        {admin && (pending === 'delete' ? (
          <ConfirmPanel message={t('groups.deleteConfirm')} confirmLabel={t('groups.delete')} danger
            loading={remove.isPending} onConfirm={() => void confirm()} onCancel={() => setPending(null)} />
        ) : (
          <Button type="button" variant="danger" full onClick={() => { setError(null); setPending('delete') }}>
            <Trash2 className="size-4" aria-hidden="true" /> {t('groups.delete')}
          </Button>
        ))}
      </div>
    </div>
  )
}
