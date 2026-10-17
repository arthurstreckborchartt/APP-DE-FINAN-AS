import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { Spinner } from '../../components/ui/Spinner'
import { normalizeLocale } from '../../lib/locale'
import { inviteUrl, useCreateInvite, useGroupInvites, useRevokeInvite } from './api'
import { ConfirmPanel } from './ConfirmPanel'
import { groupErrorKey } from './display'
import type { Group } from './types'

type Props = { open: boolean; onClose: () => void; group: Group }

export function InviteSheet({ open, onClose, group }: Props) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onClose={onClose} title={t('groups.inviteTitle')}>
      {open && <InviteContent group={group} />}
    </Sheet>
  )
}

function InviteContent({ group }: { group: Group }) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const invites = useGroupInvites(group.id, true)
  const create = useCreateInvite()
  const revoke = useRevokeInvite()
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revoked, setRevoked] = useState<string[]>([])
  const autoCreated = useRef(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Ao abrir, sem convite ativo, já cria um — uma vez só por abertura (o ref sobrevive ao StrictMode).
  const empty = invites.isSuccess && invites.data.length === 0
  const { mutate: createInvite } = create
  useEffect(() => {
    if (!empty || autoCreated.current) return
    autoCreated.current = true
    createInvite(group.id, { onError: (e) => setError(t(groupErrorKey(e))) })
  }, [empty, createInvite, group.id, t])

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  // Esconde na hora os links revogados, sem esperar o recarregamento.
  const active = (invites.data ?? []).filter((i) => !revoked.includes(i.id))
  const current = active[0] ?? (create.data && !revoked.includes(create.data.id) ? create.data : undefined)
  const url = current ? inviteUrl(current.token) : ''
  const waiting = invites.isPending || create.isPending
  const longDate = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso))
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function share() {
    if (!url) return
    try {
      await navigator.share({ title: group.name, text: t('groups.shareText', { name: group.name }), url })
    } catch (e) {
      // Cancelar a folha de compartilhamento não é erro.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(t('common.errorGeneric'))
    }
  }

  async function newLink() {
    setError(null)
    try {
      await create.mutateAsync(group.id)
    } catch (e) {
      setError(t(groupErrorKey(e)))
    }
  }

  async function confirmRevoke() {
    if (!revoking) return
    setError(null)
    try {
      await revoke.mutateAsync(revoking)
      setRevoked((ids) => [...ids, revoking])
      setRevoking(null)
    } catch (e) {
      setError(t(groupErrorKey(e)))
    }
  }

  if (invites.isError) return <QueryError onRetry={() => void invites.refetch()} />

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('groups.inviteBody')}</p>

      {waiting ? (
        <div className="grid place-items-center py-6 text-primary"><Spinner /></div>
      ) : current ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t('groups.inviteTitle')}</span>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
              className="h-12 w-full rounded-2xl bg-surface-2 px-4 text-sm font-semibold text-fg outline-none focus:bg-surface focus:outline-2 focus:outline-primary" />
          </label>
          <p className="text-[13px] font-medium text-muted">{t('groups.expiresOn', { date: longDate(current.expires_at) })}</p>
          <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <Button type="button" onClick={() => void copy()}>
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? t('groups.copied') : t('groups.copyLink')}
            </Button>
            {canShare && (
              <Button type="button" variant="secondary" onClick={() => void share()}>
                <Share2 className="size-4" aria-hidden="true" /> {t('groups.share_action')}
              </Button>
            )}
          </div>
          <p className="sr-only" aria-live="polite">{copied ? t('groups.copied') : ''}</p>
        </div>
      ) : (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold">{t('groups.noActiveInvite')}</p>
      )}

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}

      {active.length > 0 && (
        <section className="border-t border-line pt-4">
          <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">{t('groups.activeInvites')}</h3>
          <ul className="flex flex-col gap-1">
            {active.map((inv) => (
              <li key={inv.id}>
                {revoking === inv.id ? (
                  <ConfirmPanel message={t('groups.revokeConfirm')} confirmLabel={t('groups.revoke')} danger
                    loading={revoke.isPending} onConfirm={() => void confirmRevoke()} onCancel={() => setRevoking(null)} />
                ) : (
                  <div className="flex items-center gap-3 py-1.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                      <Link2 className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">…{inv.token.slice(-6)}</span>
                      <span className="block text-[13px] font-medium text-muted">{t('groups.expiresOn', { date: longDate(inv.expires_at) })}</span>
                    </span>
                    <Button type="button" variant="danger" className="h-10 px-4 text-sm" onClick={() => setRevoking(inv.id)}>
                      {t('groups.revoke')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button type="button" variant="secondary" full loading={create.isPending} onClick={() => void newLink()}>
        {t('groups.newInvite')}
      </Button>
    </div>
  )
}
