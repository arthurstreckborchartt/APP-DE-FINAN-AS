import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { supabase } from './supabase'

const TABLES = ['transactions', 'invoices', 'cards'] as const
const DEBOUNCE_MS = 300
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
    // Uma rajada de eventos (ex.: compra parcelada) gera uma única atualização.
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        for (const queryKey of AFFECTED_KEYS) void qc.invalidateQueries({ queryKey })
      }, DEBOUNCE_MS)
    }
    let channel = supabase.channel(`finance-${uid}`)
    const filter = `user_id=eq.${uid}`
    for (const table of TABLES) {
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, refresh)
        // O Supabase não entrega DELETE com filtro de coluna, então o DELETE é escutado sem filtro.
        // O evento só traz a chave primária e aqui apenas invalida o cache, então receber exclusões
        // de outros usuários é inofensivo.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, refresh)
    }
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [uid, qc])
}
