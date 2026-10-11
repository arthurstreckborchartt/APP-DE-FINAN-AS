import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { Sheet } from '../../components/ui/Sheet'
import { formatMonth } from '../../lib/dates'
import { useAccounts } from '../accounts/api'
import { usePayInvoice } from './invoicesApi'
import type { InvoiceSummary } from './types'

type Props = { invoice: InvoiceSummary; locale: string; open: boolean; onClose: () => void }

export function PayInvoiceSheet({ invoice, locale, open, onClose }: Props) {
  const { t } = useTranslation()
  const { data: accounts } = useAccounts()
  const pay = usePayInvoice()
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const eligible = (accounts ?? []).filter((a) => !a.archived && a.currency === invoice.currency)
  const selected = eligible.some((a) => a.id === accountId) ? accountId : (eligible[0]?.id ?? '')

  async function confirm() {
    if (!selected) return
    setError(null)
    try {
      await pay.mutateAsync({ invoiceId: invoice.id, accountId: selected })
      onClose()
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  function close() {
    setError(null)
    onClose()
  }

  return (
    <Sheet open={open} onClose={close} title={t('invoices.payTitle', { month: formatMonth(invoice.reference_month, locale) })}>
      <div className="flex flex-col gap-4">
        {eligible.length === 0 ? (
          <div className="rounded-2xl bg-surface-2 px-4 py-3 text-sm font-medium">
            <p>{t('invoices.noAccountInCurrency', { currency: invoice.currency })}</p>
            <Link to="/accounts" className="mt-2 inline-block font-bold text-primary underline-offset-2 hover:underline">{t('accounts.title')}</Link>
          </div>
        ) : (
          <SelectField label={t('invoices.payFrom')} value={selected} onChange={(e) => setAccountId(e.target.value)}>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </SelectField>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-muted">{t('invoices.total')}</span>
          <Amount cents={invoice.total} currency={invoice.currency} locale={locale} className="text-2xl font-extrabold tracking-[-0.02em]" />
        </div>
        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <Button full loading={pay.isPending} disabled={!selected} onClick={() => void confirm()}>{t('invoices.payConfirm')}</Button>
      </div>
    </Sheet>
  )
}
