import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Card, CardInput, CardPatch, CardWithLimit } from './types'

/** Cartões com o limite usado (parcelas em faturas não pagas) e o disponível. */
export function useCards() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['cards', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CardWithLimit[]> => {
      const [cards, limits] = await Promise.all([
        supabase.from('cards').select('*').order('created_at'),
        supabase.from('card_limits').select('card_id, used, available'),
      ])
      if (cards.error) throw cards.error
      if (limits.error) throw limits.error
      const byId = new Map(
        limits.data.map((l) => [l.card_id as string, { used: Number(l.used), available: Number(l.available) }]),
      )
      return (cards.data as Card[]).map((c) => {
        const limit_amount = Number(c.limit_amount)
        return { ...c, limit_amount, ...(byId.get(c.id) ?? { used: 0, available: limit_amount }) }
      })
    },
  })
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CardInput) => {
      const { data, error } = await supabase.from('cards').insert(input).select().single()
      if (error) throw error
      return data as Card
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CardPatch }) => {
      const { data, error } = await supabase.from('cards').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Card
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cards').delete().eq('id', id)
      if (error) throw error
    },
    // Excluir o cartão apaga as faturas dele em cascata.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['cards'] }),
        qc.invalidateQueries({ queryKey: ['invoices'] }),
      ]),
  })
}
