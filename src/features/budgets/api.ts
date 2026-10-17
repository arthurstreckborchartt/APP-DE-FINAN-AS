import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Budget, BudgetInput } from './types'

const invalidateBudgets = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ['budgets'] })

/** O RLS filtra em silêncio: 0 linhas significa sem permissão (ou o orçamento não existe mais). */
function assertAffected(rows: unknown[] | null) {
  if (!rows || rows.length === 0) throw new Error('budget_not_changed')
}

const toBudget = (b: Budget): Budget => ({ ...b, amount: Number(b.amount) })

/** Orçamentos pessoais. O filtro por `user_id` é obrigatório: o RLS também devolve os dos grupos. */
export function useBudgets() {
  const { user } = useAuth()
  const uid = user?.id
  return useQuery({
    queryKey: ['budgets', uid, 'mine'],
    enabled: !!uid,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from('budgets').select('*').eq('user_id', uid!).order('created_at')
      if (error) throw error
      return (data as Budget[]).map(toBudget)
    },
  })
}

export function useGroupBudgets(groupId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['budgets', user?.id, 'group', groupId],
    enabled: !!user && !!groupId,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from('budgets').select('*').eq('group_id', groupId!).order('created_at')
      if (error) throw error
      return (data as Budget[]).map(toBudget)
    },
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BudgetInput): Promise<Budget> => {
      const { data, error } = await supabase.from('budgets').insert(input).select().single()
      if (error) throw error
      return toBudget(data as Budget)
    },
    onSuccess: () => invalidateBudgets(qc),
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data, error } = await supabase.from('budgets').update({ amount }).eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: () => invalidateBudgets(qc),
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('budgets').delete().eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: () => invalidateBudgets(qc),
  })
}
