import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { monthRange } from '../../lib/dates'
import { useAuth } from '../auth/auth-context'
import type { Transaction, TransactionInput } from './types'

export function useTransactions(month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'month', month],
    enabled: !!user,
    queryFn: async () => {
      const { start, end } = monthRange(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Transaction[]
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

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
