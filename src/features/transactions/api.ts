import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { MonthEntry, Transaction, TransactionInput } from './types'

/** Linha da view `month_entries` (competência: lançamento em conta ou parcela de cartão). */
export type MonthEntryRow = Omit<MonthEntry, 'id' | 'updated_at'> & { month: string }

/** Converte uma linha de `month_entries` em entrada: `id` vira o do lançamento. */
export function toMonthEntry(row: MonthEntryRow): MonthEntry {
  return {
    id: row.transaction_id,
    entry_id: row.entry_id,
    transaction_id: row.transaction_id,
    user_id: row.user_id,
    kind: row.kind,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.date,
    purchase_date: row.purchase_date,
    category_id: row.category_id,
    description: row.description,
    account_id: row.account_id,
    card_id: row.card_id,
    installment_number: row.installment_number,
    installments_count: row.installments_count,
    total_amount: Number(row.total_amount),
    recurring_id: row.recurring_id ?? null,
    group_id: row.group_id ?? null,
    created_at: row.created_at,
    // A view não expõe updated_at; created_at é o valor mais próximo disponível.
    updated_at: row.created_at,
  }
}

export function useTransactions(month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'month', month],
    enabled: !!user,
    queryFn: async (): Promise<MonthEntry[]> => {
      const { data, error } = await supabase
        .from('month_entries')
        .select('*')
        .eq('month', `${month}-01`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as MonthEntryRow[]).map(toMonthEntry)
    },
  })
}

export function useRecentTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'recent'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useTransaction(id: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'one', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Transaction
    },
  })
}

function useInvalidateFinance() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['cards'] }),
      qc.invalidateQueries({ queryKey: ['invoices'] }),
    ])
}

export function useCreateTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { data, error } = await supabase.from('transactions').insert(input).select().single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TransactionInput }) => {
      const { data, error } = await supabase.from('transactions').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: invalidate,
  })
}

const isOneOf = (id: string) => (q: { queryKey: readonly unknown[] }) =>
  q.queryKey[2] === 'one' && q.queryKey[3] === id

export function afterDeleteTransaction(qc: QueryClient, id: string) {
  const isDeleted = isOneOf(id)
  qc.removeQueries({ queryKey: ['transactions'], predicate: isDeleted })
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['transactions'], predicate: (q) => !isDeleted(q) }),
    qc.invalidateQueries({ queryKey: ['accounts'] }),
    qc.invalidateQueries({ queryKey: ['cards'] }),
    qc.invalidateQueries({ queryKey: ['invoices'] }),
  ])
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, id) => afterDeleteTransaction(qc, id),
  })
}
