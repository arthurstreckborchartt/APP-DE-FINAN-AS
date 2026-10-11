import type { Transaction, TransactionKind } from './types'

export type TransactionFilters = {
  kind?: TransactionKind
  accountId?: string
  categoryId?: string
  search?: string
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function filterTransactions<T extends Transaction>(
  list: T[],
  filters: TransactionFilters,
  labelOf: (categoryId: string) => string,
): T[] {
  const q = filters.search ? normalize(filters.search) : ''
  return list.filter(
    (tx) =>
      (!filters.kind || tx.kind === filters.kind) &&
      (!filters.accountId || tx.account_id === filters.accountId) &&
      (!filters.categoryId || tx.category_id === filters.categoryId) &&
      (!q || normalize(tx.description).includes(q) || normalize(labelOf(tx.category_id)).includes(q)),
  )
}

export type DayGroup<T extends Transaction = Transaction> = { date: string; items: T[] }

export function groupByDate<T extends Transaction>(list: T[]): DayGroup<T>[] {
  const byDate = new Map<string, T[]>()
  for (const tx of list) {
    const items = byDate.get(tx.date)
    if (items) items.push(tx)
    else byDate.set(tx.date, [tx])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
}

export type CurrencySummary = { currency: string; income: number; expense: number; net: number }

export function summarizeByCurrency(list: Transaction[]): CurrencySummary[] {
  const byCurrency = new Map<string, CurrencySummary>()
  for (const tx of list) {
    let s = byCurrency.get(tx.currency)
    if (!s) {
      s = { currency: tx.currency, income: 0, expense: 0, net: 0 }
      byCurrency.set(tx.currency, s)
    }
    if (tx.kind === 'income') s.income += tx.amount
    else s.expense += tx.amount
    s.net = s.income - s.expense
  }
  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}

export type CategoryShare = { categoryId: string; total: number; share: number }

/** Despesas de uma moeda somadas por categoria, da maior para a menor, com a fatia de cada uma. */
export function expensesByCategory(list: Transaction[], currency: string): CategoryShare[] {
  const totals = new Map<string, number>()
  let sum = 0
  for (const tx of list) {
    if (tx.kind !== 'expense' || tx.currency !== currency) continue
    totals.set(tx.category_id, (totals.get(tx.category_id) ?? 0) + tx.amount)
    sum += tx.amount
  }
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total, share: sum ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total)
}
