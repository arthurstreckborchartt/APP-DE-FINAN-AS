import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wallet } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { Button } from '../../components/ui/Button'
import { IconTile, PageHeader, RowItem, RowList } from '../../components/ui/Card'
import { HERO_NUMBER, HeroValue } from '../../components/ui/HeroCard'
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
      <RowItem key={a.id}>
        <button type="button" onClick={() => open(a)}
          className="flex w-full items-center gap-3.5 px-3.5 py-3 text-left transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
          <IconTile icon={Icon} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{a.name}</span>
            <span className="block text-[13px] font-medium text-muted">{t(`accounts.types.${a.type}`)} · {a.currency}</span>
          </span>
          <Amount cents={a.balance} currency={a.currency} locale={locale}
            className={`shrink-0 whitespace-nowrap text-[15px] font-extrabold ${a.balance < 0 ? 'text-danger' : ''}`} />
        </button>
      </RowItem>
    )
  }

  const busy = create.isPending || update.isPending || remove.isPending
  const editingAccount = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader title={t('accounts.title')} action={
        <Button className="h-11 shrink-0" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('accounts.new')}
        </Button>
      } />

      {totals.length > 0 && (
        <section aria-labelledby="accounts-total" className="mt-6 rounded-card bg-surface p-5 sm:p-6">
          {totals.slice(0, 1).map((s) => (
            <HeroValue key={s.currency}>
              <Amount cents={s.total} currency={s.currency} locale={locale} smallSymbol
                className={`${HERO_NUMBER} ${s.total < 0 ? 'text-danger' : ''}`} />
            </HeroValue>
          ))}
          <p id="accounts-total" className="mt-1.5 text-[15px] font-semibold text-muted">{t('accounts.total')}</p>
          {totals.length > 1 && (
            <p className="mt-3 flex flex-wrap gap-2">
              {totals.slice(1).map((s) => (
                <Amount key={s.currency} cents={s.total} currency={s.currency} locale={locale}
                  className="rounded-full bg-bg px-3 py-1.5 text-[15px] font-bold dark:bg-surface-2" />
              ))}
            </p>
          )}
        </section>
      )}

      <div className="mt-6">
        {active.length === 0 ? (
          <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
            action={<Button className="h-11" onClick={() => open('new')}>{t('accounts.new')}</Button>} />
        ) : (
          <RowList>{active.map(row)}</RowList>
        )}
      </div>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-surface px-4 text-sm font-bold text-muted hover:text-fg">{t('accounts.archivedSection')}</summary>
          <RowList className="mt-3 opacity-75">{archived.map(row)}</RowList>
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
