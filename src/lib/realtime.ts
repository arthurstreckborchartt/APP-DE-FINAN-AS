import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '../features/auth/auth-context'
import { useMyGroups } from '../features/groups/api'
import { supabase } from './supabase'

const DEBOUNCE_MS = 300
const AFFECTED_KEYS = [['transactions'], ['accounts'], ['cards'], ['invoices'], ['recurring'], ['groups'], ['budgets'], ['goals']] as const

/** Canais privados exigem o JWT no socket; se falhar, assina mesmo assim (o status avisa). */
async function ensureAuth() {
  try {
    await supabase.realtime.setAuth()
  } catch (e) {
    console.warn('realtime: setAuth falhou', e)
  }
}

function subscribeTopic(topic: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(topic, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, onChange)
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn(`realtime ${topic}: ${status}`, err)
    })
}

/**
 * Mantém os dados em dia entre aparelhos e membros de grupo. Canais privados: "user:<id>" e
 * "group:<id>" de cada grupo. O banco só manda avisos sem dados; aqui apenas invalida o cache.
 *
 * Um canal nunca é removido e recriado enquanto o tópico continua desejado: no realtime-js,
 * `channel(topic)` devolve o canal antigo enquanto a remoção não foi confirmada, e a nova
 * assinatura seria perdida. Por isso o canal do usuário depende só do `uid` e os de grupo são
 * reconciliados por diferença.
 */
export function useRealtimeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id
  const groups = useMyGroups().data
  const groupKey = (groups ?? []).map((g) => g.id).sort().join(',')

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const refresh = useRef<() => void>(() => {})
  const groupChannels = useRef(new Map<string, RealtimeChannel>())

  // Uma rajada de avisos (ex.: compra parcelada) gera uma única atualização.
  useEffect(() => {
    refresh.current = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        for (const queryKey of AFFECTED_KEYS) void qc.invalidateQueries({ queryKey })
      }, DEBOUNCE_MS)
    }
  }, [qc])
  useEffect(() => () => clearTimeout(timer.current), [])

  // Canal do usuário: só muda com o usuário. Também limpa os canais de grupo ao trocar/sair.
  useEffect(() => {
    if (!uid) return
    const channels = groupChannels.current
    let cancelled = false
    let channel: RealtimeChannel | undefined
    void ensureAuth().then(() => {
      if (!cancelled) channel = subscribeTopic(`user:${uid}`, () => refresh.current())
    })
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
      for (const ch of channels.values()) void supabase.removeChannel(ch)
      channels.clear()
    }
  }, [uid])

  // Canais de grupo: assina os novos e remove os que saíram, sem mexer nos demais.
  useEffect(() => {
    const channels = groupChannels.current
    const wanted = new Set(uid ? groupKey.split(',').filter(Boolean).map((id) => `group:${id}`) : [])
    for (const [topic, ch] of channels) {
      if (!wanted.has(topic)) {
        channels.delete(topic)
        void supabase.removeChannel(ch)
      }
    }
    const toAdd = [...wanted].filter((topic) => !channels.has(topic))
    if (toAdd.length === 0) return
    let cancelled = false
    void ensureAuth().then(() => {
      if (cancelled) return
      for (const topic of toAdd) {
        if (!channels.has(topic)) channels.set(topic, subscribeTopic(topic, () => refresh.current()))
      }
    })
    return () => {
      cancelled = true
    }
  }, [uid, groupKey])
}
