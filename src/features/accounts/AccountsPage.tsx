import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { isForeignKeyViolation } from '../../lib/db-errors'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useProfile } from '../profile/api'
import { ACCOUNT_TYPE_ICONS } from './accountTypes'
import { AccountForm } from './AccountForm'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from './api'
import { balancesByCurrency } from './totals'
import type { AccountInput, AccountWithBalance } from './types'

export default function AccountsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const { data: profile } = useProfile()
  const { data: accounts, isPending, isError, refetch } = useAccounts()
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const remove = useDeleteAccount()
  const [editing, setEditing] = useState<AccountWithBalance | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isPending) return <FullScreenSpinner />
  if (isError || !accounts) return <QueryError onRetry={() => void refetch()} />

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const totals = balancesByCurrency(accounts)

  function open(target: AccountWithBalance | 'new') {
    setError(null)
    setConfirmDelete(false)
    setEditing(target)
  }

  async function save(value: AccountInput) {
    setError(null)
    setConfirmDelete(false)
    try {
      if (editing === 'new') await create.mutateAsync(value)
      else if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { name: value.name, type: value.type, initial_balance: value.initial_balance },
        })
      }
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function toggleArchive(account: AccountWithBalance) {
    setError(null)
    setConfirmDelete(false)
    try {
      await update.mutateAsync({ id: account.id, patch: { archived: !account.archived } })
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function destroy(account: AccountWithBalance) {
    setError(null)
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(account.id)
      setEditing(null)
    } catch (e) {
      setConfirmDelete(false)
      setError(t(isForeignKeyViolation(e) ? 'accounts.deleteBlocked' : 'common.errorGeneric'))
    }
  }

  const row = (a: AccountWithBalance) => {
    const Icon = ACCOUNT_TYPE_ICONS[a.type]
    return (
      <li key={a.id}>
        <button type="button" onClick={() => open(a)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:bg-surface-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.name}</span>
            <span className="block text-sm text-muted">{t(`accounts.types.${a.type}`)} · {a.currency}</span>
          </span>
          <span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${a.balance < 0 ? 'text-danger' : ''}`}>
            {formatMoney(a.balance, a.currency, locale)}
          </span>
        </button>
      </li>
    )
  }

  const busy = create.isPending || update.isPending || remove.isPending
  const editingAccount = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('accounts.title')}</h1>
        <Button className="h-10" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('accounts.new')}
        </Button>
      </div>

      {totals.length > 0 && (
        <div className="mt-6 rounded-2xl bg-primary p-5 text-primary-fg">
          <p className="text-sm opacity-80">{t('accounts.total')}</p>
          {totals.map((s) => (
            <p key={s.currency} className="text-2xl font-bold tabular-nums">{formatMoney(s.total, s.currency, locale)}</p>
          ))}
        </div>
      )}

      <div className="mt-6">
        {active.length === 0 ? (
          <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
            action={<Button className="h-10" onClick={() => open('new')}>{t('accounts.new')}</Button>} />
        ) : (
          <ul className="flex flex-col gap-2">{active.map(row)}</ul>
        )}
      </div>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer py-2 text-sm font-medium text-muted">{t('accounts.archivedSection')}</summary>
          <ul className="mt-2 flex flex-col gap-2 opacity-70">{archived.map(row)}</ul>
        </details>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? t('accounts.new') : t('accounts.edit')}>
        {editing && (
          <AccountForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new'
              ? { name: '', type: 'checking', currency: profile?.currency ?? 'BRL', initial_balance: 0 }
              : editing}
            currencyEditable={editing === 'new'}
            submitLabel={t('common.save')}
            loading={create.isPending || update.isPending}
            error={error}
            onSubmit={(v) => void save(v)}
          >
            {editingAccount && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" loading={update.isPending} disabled={busy} onClick={() => void toggleArchive(editingAccount)}>
                  {editingAccount.archived ? t('common.unarchive') : t('common.archive')}
                </Button>
                <Button type="button" variant="danger" loading={remove.isPending} disabled={busy} onClick={() => void destroy(editingAccount)}>
                  {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
                </Button>
              </div>
            )}
          </AccountForm>
        )}
      </Sheet>
    </section>
  )
}
