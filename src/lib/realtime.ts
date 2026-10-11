import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { supabase } from './supabase'

const TABLES = ['transactions', 'invoices', 'cards'] as const
const AFFECTED_KEYS = [['transactions'], ['accounts'], ['cards'], ['invoices']] as const

/**
 * Mantém os dados em dia entre aparelhos: qualquer mudança em lançamentos, faturas ou cartões
 * do usuário invalida as consultas que dependem deles.
 */
export function useRealtimeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id

  useEffect(() => {
    if (!uid) return
    const refresh = () => {
      for (const queryKey of AFFECTED_KEYS) void qc.invalidateQueries({ queryKey })
    }
    let channel = supabase.channel(`finance-${uid}`)
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` }, refresh)
    }
    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [uid, qc])
}
