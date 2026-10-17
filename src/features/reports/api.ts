import { useQuery } from '@tanstack/react-query'
import { monthOf } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { GroupPeriodEntry } from '../groups/types'
import { toMonthEntry, type MonthEntryRow } from '../transactions/api'
import type { MonthEntry } from '../transactions/types'

/** Entrada de competência com o mês ('YYYY-MM'). */
export type RangeEntry = MonthEntry & { month: string }

/** Entradas pessoais de competência de `from` a `to` ('YYYY-MM', inclusivo). */
export function useEntriesRange(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'range', from, to],
    enabled: !!user,
    queryFn: async (): Promise<RangeEntry[]> => {
      const { data, error } = await supabase
        .from('month_entries')
        .select('*')
        .gte('month', `${from}-01`)
        .lte('month', `${to}-01`)
      if (error) throw error
      return (data as MonthEntryRow[]).map((row) => ({ ...toMonthEntry(row), month: monthOf(row.month) }))
    },
  })
}

/** Entradas do grupo no intervalo (máx. 24 meses no servidor). */
export function useGroupPeriodEntries(groupId: string | undefined, from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, groupId, 'period', from, to],
    enabled: !!user && !!groupId,
    queryFn: async (): Promise<GroupPeriodEntry[]> => {
      const { data, error } = await supabase.rpc('group_period_entries', {
        p_group: groupId!,
        p_from: `${from}-01`,
        p_to: `${to}-01`,
      })
      if (error) throw error
      return (data as GroupPeriodEntry[]).map((e) => ({ ...e, amount: Number(e.amount), month: monthOf(e.month) }))
    },
  })
}
