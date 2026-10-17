import type { GroupEntry, GroupMember } from './types'

export type MemberTotal = { user_id: string; name: string; amount: number; share: number; left: boolean }
export type CategoryTotal = {
  category_id: string
  name: string | null
  key: string | null
  icon: string
  color: string
  amount: number
}

const byAmountThenName = <T extends { amount: number }>(name: (x: T) => string) => (a: T, b: T) =>
  b.amount - a.amount || name(a).localeCompare(name(b))

/**
 * Só despesas. `share` em 0..100 inteiro (arredondado). Membros ativos sem gasto entram com 0;
 * quem saiu só aparece se gastou. Ordem: valor desc, depois nome.
 */
export function groupMonthStats(
  entries: GroupEntry[],
  members: GroupMember[],
): { total: number; byMember: MemberTotal[]; byCategory: CategoryTotal[] } {
  const expenses = entries.filter((e) => e.kind === 'expense')
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const spent = new Map<string, number>()
  const categories = new Map<string, CategoryTotal>()
  for (const e of expenses) {
    spent.set(e.user_id, (spent.get(e.user_id) ?? 0) + e.amount)
    const cat = categories.get(e.category_id)
    if (cat) cat.amount += e.amount
    else
      categories.set(e.category_id, {
        category_id: e.category_id,
        name: e.category_name,
        key: e.category_key,
        icon: e.category_icon,
        color: e.category_color,
        amount: e.amount,
      })
  }

  const byMember: MemberTotal[] = members
    .filter((m) => m.left_at === null || spent.has(m.user_id))
    .map((m) => {
      const amount = spent.get(m.user_id) ?? 0
      return {
        user_id: m.user_id,
        name: m.name,
        amount,
        share: total > 0 ? Math.round((amount / total) * 100) : 0,
        left: m.left_at !== null,
      }
    })
    .sort(byAmountThenName((m) => m.name))

  const byCategory = [...categories.values()].sort(byAmountThenName((c) => c.name ?? c.key ?? ''))

  return { total, byMember, byCategory }
}
