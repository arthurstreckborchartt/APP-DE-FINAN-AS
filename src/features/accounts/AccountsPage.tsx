import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wallet } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { isForeignKeyViolation } from '../../lib/db-errors'
import { normalizeLocale } from '../../lib/locale'
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
          className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition hover:bg-surface-2">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{a.name}</span>
            <span className="block text-[13px] font-medium text-muted">{t(`accounts.types.${a.type}`)} · {a.currency}</span>
          </span>
          <Amount cents={a.balance} currency={a.currency} locale={locale}
            className={`shrink-0 whitespace-nowrap text-[15px] font-extrabold ${a.balance < 0 ? 'text-danger' : ''}`} />
        </button>
      </li>
    )
  }

  const busy = create.isPending || update.isPending || remove.isPending
  const editingAccount = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('accounts.title')}</h1>
        <Button className="h-11" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('accounts.new')}
        </Button>
      </div>

      {totals.length > 0 && (
        <div className="brand-panel mt-6 rounded-[28px] p-6 shadow-float sm:p-7">
          <p className="text-[15px] font-medium text-brand-muted">{t('accounts.total')}</p>
          {totals.map((s, i) => (
            <Amount key={s.currency} cents={s.total} currency={s.currency} locale={locale}
              className={`block ${i === 0 ? 'mt-1 text-[34px] font-extrabold tracking-[-0.03em] sm:text-[40px]' : 'text-lg font-bold text-brand-muted'}`} />
          ))}
        </div>
      )}

      <div className="mt-6">
        {active.length === 0 ? (
          <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
            action={<Button className="h-10" onClick={() => open('new')}>{t('accounts.new')}</Button>} />
        ) : (
          <ul className="flex flex-col rounded-[24px] bg-surface p-2 shadow-sheet">{active.map(row)}</ul>
        )}
      </div>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer rounded-full px-2 py-2 text-sm font-bold text-muted">{t('accounts.archivedSection')}</summary>
          <ul className="mt-2 flex flex-col rounded-[24px] bg-surface p-2 opacity-75 shadow-sheet">{archived.map(row)}</ul>
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
