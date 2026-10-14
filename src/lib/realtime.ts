import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '../features/auth/auth-context'
import { useMyGroups } from '../features/groups/api'
import { supabase } from './supabase'

const DEBOUNCE_MS = 300
const AFFECTED_KEYS = [['transactions'], ['accounts'], ['cards'], ['invoices'], ['recurring'], ['groups']] as const

/**
 * Mantém os dados em dia entre aparelhos e membros de grupo. Canais privados: "user:<id>" e
 * "group:<id>" de cada grupo. O banco só manda avisos sem dados; aqui apenas invalida o cache.
 */
export function useRealtimeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id
  const groups = useMyGroups().data
  const groupKey = (groups ?? []).map((g) => g.id).sort().join(',')

  useEffect(() => {
    if (!uid) return
    // Uma rajada de avisos (ex.: compra parcelada) gera uma única atualização.
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const channels: RealtimeChannel[] = []
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        for (const queryKey of AFFECTED_KEYS) void qc.invalidateQueries({ queryKey })
      }, DEBOUNCE_MS)
    }
    const topics = [`user:${uid}`, ...groupKey.split(',').filter(Boolean).map((id) => `group:${id}`)]
    // Canais privados exigem o JWT do usuário no socket antes de assinar.
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      for (const topic of topics) {
        channels.push(
          supabase
            .channel(topic, { config: { private: true } })
            .on('broadcast', { event: 'changed' }, refresh)
            .subscribe(),
        )
      }
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
      for (const ch of channels) void supabase.removeChannel(ch)
    }
  }, [uid, groupKey, qc])
}
