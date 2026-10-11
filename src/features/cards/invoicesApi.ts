import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { InvoiceItem, InvoiceSummary } from './types'

const SUMMARY_COLUMNS =
  'id, card_id, reference_month, closing_date, due_date, paid_at, payment_account_id, payment_amount, currency, total, items'

function toInvoiceSummary(row: InvoiceSummary): InvoiceSummary {
  return {
    ...row,
    payment_amount: row.payment_amount === null ? null : Number(row.payment_amount),
    total: Number(row.total),
    items: Number(row.items),
  }
}

/** Faturas de um cartão, da mais antiga para a mais nova. */
export function useCardInvoices(cardId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['invoices', user?.id, cardId],
    enabled: !!user && !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_summaries')
        .select(SUMMARY_COLUMNS)
        .eq('card_id', cardId!)
        .order('reference_month')
      if (error) throw error
      return (data as unknown as InvoiceSummary[]).map(toInvoiceSummary)
    },
  })
}

/** Faturas ainda não pagas de todos os cartões (para o Início). */
export function useAllOpenInvoices() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['invoices', user?.id, 'unpaid'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_summaries')
        .select(SUMMARY_COLUMNS)
        .is('paid_at', null)
        .order('reference_month')
      if (error) throw error
      return (data as unknown as InvoiceSummary[]).map(toInvoiceSummary)
    },
  })
}

/** Parcelas de uma fatura, com o lançamento de origem. */
export function useInvoiceItems(invoiceId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['invoices', user?.id, 'items', invoiceId],
    enabled: !!user && !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('id, number, amount, transaction:transactions(id, description, category_id, installments_count, date, amount)')
        .eq('invoice_id', invoiceId!)
      if (error) throw error
      return (data as unknown as InvoiceItem[]).map((i) => ({
        ...i,
        amount: Number(i.amount),
        transaction: { ...i.transaction, amount: Number(i.transaction.amount) },
      }))
    },
  })
}

function useInvalidateInvoices() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['invoices'] }),
      qc.invalidateQueries({ queryKey: ['cards'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
    ])
}

export function usePayInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: async ({ invoiceId, accountId }: { invoiceId: string; accountId: string }) => {
      const { error } = await supabase.rpc('pay_invoice', { p_invoice: invoiceId, p_account: accountId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useReopenInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.rpc('reopen_invoice', { p_invoice: invoiceId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
