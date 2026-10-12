import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/dates'
import { useAuth } from '../auth/auth-context'
import type { Recurring, RecurringInput, RecurringPatch } from './types'

/** Dados que mudam quando ocorrências são geradas (ou a recorrente muda). */
export const RECURRING_AFFECTED_KEYS = [
  ['recurring'], ['transactions'], ['accounts'], ['cards'], ['invoices'],
] as const

export function invalidateRecurringData(qc: QueryClient) {
  return Promise.all(RECURRING_AFFECTED_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

/** Gera as ocorrências vencidas (data local do usuário) e devolve quantas foram criadas. */
async function generateNow(): Promise<number> {
  const { data, error } = await supabase.rpc('generate_my_recurring', { p_today: todayISO() })
  if (error) throw error
  return Number(data ?? 0)
}

/** Só roda uma vez por usuário nesta sessão do app. */
export function shouldGenerateOnOpen(lastUserId: string | null, userId: string | undefined): boolean {
  return !!userId && lastUserId !== userId
}

export function useRecurring() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['recurring', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Recurring[]> => {
      const { data, error } = await supabase.from('recurring').select('*').order('next_date')
      if (error) throw error
      return (data as Recurring[]).map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecurringInput) => {
      const { data, error } = await supabase.from('recurring').insert(input).select().single()
      if (error) throw error
      // Se começa hoje ou antes, já gera; falha na geração não desfaz o cadastro (o cron cobre).
      await generateNow().catch(() => 0)
      return data as Recurring
    },
    onSuccess: () => invalidateRecurringData(qc),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: RecurringPatch }) => {
      const { data, error } = await supabase.from('recurring').update(patch).eq('id', id).select().single()
      if (error) throw error
      await generateNow().catch(() => 0)
      return data as Recurring
    },
    onSuccess: () => invalidateRecurringData(qc),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring').delete().eq('id', id)
      if (error) throw error
    },
    // Os lançamentos já gerados ficam (recurring_id vira nulo).
    onSuccess: () => invalidateRecurringData(qc),
  })
}

/** Ao abrir o app (uma vez por usuário), gera o que venceu. Nunca bloqueia nem mostra erro. */
export function useGenerateRecurringOnOpen() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const doneFor = useRef<string | null>(null)
  const uid = user?.id
  useEffect(() => {
    if (!shouldGenerateOnOpen(doneFor.current, uid)) return
    doneFor.current = uid ?? null
    generateNow()
      .then((created) => (created > 0 ? invalidateRecurringData(qc) : undefined))
      .catch(() => undefined)
  }, [uid, qc])
}
