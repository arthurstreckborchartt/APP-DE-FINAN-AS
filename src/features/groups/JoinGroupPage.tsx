import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Link2Off } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { clearReturnTo } from '../../lib/return-to'
import { useInvitePreview, useJoinGroup } from './api'
import { joinErrorKey } from './display'
import { GroupIcon } from './GroupIcon'

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] bg-surface p-6 text-center shadow-sheet sm:p-8">
        {children}
      </div>
    </div>
  )
}

export default function JoinGroupPage() {
  const { token } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const preview = useInvitePreview(token)
  const join = useJoinGroup()
  const [errorKey, setErrorKey] = useState<string | null>(null)

  // Chegou ao convite: o destino guardado para depois do login já foi usado.
  useEffect(() => clearReturnTo(), [])

  if (preview.isPending) return <div className="min-h-[40vh]"><FullScreenSpinner /></div>
  if (preview.isError) return <QueryError onRetry={() => void preview.refetch()} />

  const data = preview.data
  const unavailable = !data ? 'groups.join.invalid'
    : data.status === 'expired' ? 'groups.join.expired'
      : data.status === 'removed' ? 'groups.join.removed'
        : null

  if (!data || unavailable) {
    return (
      <Card>
        <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted">
          <Link2Off className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">{t('groups.join.title')}</h1>
        <p role="alert" className="text-[15px] font-medium text-muted">{t(unavailable ?? 'groups.join.invalid')}</p>
        <Link to="/groups" className="mt-1 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold text-fg hover:bg-surface-3">{t('groups.title')}</Link>
      </Card>
    )
  }

  async function onJoin() {
    if (!token) return
    setErrorKey(null)
    try {
      const groupId = await join.mutateAsync(token)
      navigate(`/groups/${groupId}`, { replace: true, state: { joined: true } })
    } catch (e) {
      setErrorKey(joinErrorKey(e))
    }
  }

  const member = data.status === 'member'

  return (
    <Card>
      <GroupIcon name={data.icon} />
      <div>
        <p className="text-[15px] font-medium text-muted">{t('groups.join.body')}</p>
        <h1 className="mt-1 break-words text-[28px] font-extrabold tracking-[-0.03em]">{data.name}</h1>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[15px] font-medium text-muted">
          {t('groups.members', { count: data.members })}
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">{data.currency}</span>
        </p>
      </div>
      {member ? (
        <>
          <p role="status" className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-sm font-medium">{t('groups.join.already')}</p>
          <Button full onClick={() => navigate(`/groups/${data.group_id}`, { replace: true })}>{t('groups.join.open')}</Button>
        </>
      ) : (
        <>
          <p className="text-[13px] font-medium text-muted">{t('groups.privacyNote')}</p>
          {errorKey && <p role="alert" className="w-full rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{t(errorKey)}</p>}
          <Button full loading={join.isPending} onClick={() => void onJoin()}>{t('groups.join.action')}</Button>
        </>
      )}
    </Card>
  )
}
