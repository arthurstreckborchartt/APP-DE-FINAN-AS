import { useQuery } from '@tanstack/react-query'
import { monthOf } from '../../lib/dates'
import { fetchAllPages } from '../../lib/paginate'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { GroupPeriodEntry } from '../groups/types'
import type { MonthEntry } from '../transactions/types'

/** Entrada de competência com o mês ('YYYY-MM'): só as colunas que os relatórios usam. */
export type RangeEntry = Pick<MonthEntry, 'kind' | 'amount' | 'currency' | 'category_id' | 'account_id' | 'card_id'> & {
  month: string
}

const RANGE_COLUMNS = 'kind, amount, currency, month, category_id, account_id, card_id'

/** Entradas pessoais de competência de `from` a `to` ('YYYY-MM', inclusivo), todas as páginas. */
export function useEntriesRange(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'range', from, to],
    enabled: !!user,
    queryFn: async (): Promise<RangeEntry[]> => {
      // Ordem total estável para que as páginas não repitam nem pulem linhas.
      const rows = await fetchAllPages<RangeEntry>((start, end) =>
        supabase
          .from('month_entries')
          .select(RANGE_COLUMNS)
          .gte('month', `${from}-01`)
          .lte('month', `${to}-01`)
          .order('month')
          .order('date')
          .order('entry_id')
          .range(start, end)
          .returns<RangeEntry[]>(),
      )
      return rows.map((row) => ({ ...row, amount: Number(row.amount), month: monthOf(row.month) }))
    },
  })
}

/** Entradas do grupo no intervalo (máx. 24 meses no servidor), todas as páginas. */
export function useGroupPeriodEntries(groupId: string | undefined, from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, groupId, 'period', from, to],
    enabled: !!user && !!groupId,
    queryFn: async (): Promise<GroupPeriodEntry[]> => {
      // A função já ordena de forma determinística (date desc, created_at desc, entry_id).
      const rows = await fetchAllPages((start, end) =>
        supabase
          .rpc('group_period_entries', { p_group: groupId!, p_from: `${from}-01`, p_to: `${to}-01` })
          .range(start, end) as PromiseLike<{ data: GroupPeriodEntry[] | null; error: unknown }>,
      )
      return rows.map((e) => ({ ...e, amount: Number(e.amount), month: monthOf(e.month) }))
    },
  })
}
