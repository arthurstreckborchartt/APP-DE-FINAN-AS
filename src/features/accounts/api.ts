import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Account, AccountInput, AccountPatch, AccountWithBalance } from './types'

export function useAccounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['accounts', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const [accounts, balances] = await Promise.all([
        supabase.from('accounts').select('*').order('created_at'),
        supabase.from('account_balances').select('account_id, balance'),
      ])
      if (accounts.error) throw accounts.error
      if (balances.error) throw balances.error
      const byId = new Map(balances.data.map((b) => [b.account_id as string, Number(b.balance)]))
      return (accounts.data as Account[]).map((a) => ({ ...a, balance: byId.get(a.id) ?? a.initial_balance }))
    },
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AccountInput) => {
      const { data, error } = await supabase.from('accounts').insert(input).select().single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AccountPatch }) => {
      const { data, error } = await supabase.from('accounts').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
