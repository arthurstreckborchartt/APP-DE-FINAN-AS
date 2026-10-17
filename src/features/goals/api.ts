import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Goal, GoalContribution, GoalContributionInput, GoalInput, GoalPatch } from './types'

const invalidateGoals = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ['goals'] })

function assertAffected(rows: unknown[] | null) {
  if (!rows || rows.length === 0) throw new Error('goal_not_changed')
}

const toGoal = (g: Goal): Goal => ({
  ...g,
  target_amount: Number(g.target_amount),
  saved: Number(g.saved),
  contributions: Number(g.contributions),
})

export function useGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goals', user?.id, 'list'],
    enabled: !!user,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from('goal_progress').select('*').order('archived').order('created_at')
      if (error) throw error
      return (data as Goal[]).map(toGoal)
    },
  })
}

export function useGoalContributions(goalId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goals', user?.id, goalId, 'contributions'],
    enabled: !!user && !!goalId,
    queryFn: async (): Promise<GoalContribution[]> => {
      const { data, error } = await supabase
        .from('goal_contributions')
        .select('*')
        .eq('goal_id', goalId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as GoalContribution[]).map((c) => ({ ...c, amount: Number(c.amount) }))
    },
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: GoalInput): Promise<string> => {
      const { data, error } = await supabase.from('goals').insert(input).select('id').single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: GoalPatch }) => {
      const { data, error } = await supabase.from('goals').update(patch).eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

/** Os aportes vão junto (cascata). */
export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('goals').delete().eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

/** `amount` negativo é retirada; o banco recusa se o guardado ficaria negativo (hint `goal_negative`). */
export function useAddContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: GoalContributionInput) => {
      const { error } = await supabase.from('goal_contributions').insert(input)
      if (error) throw error
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

export function useDeleteContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('goal_contributions').delete().eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: () => invalidateGoals(qc),
  })
}
