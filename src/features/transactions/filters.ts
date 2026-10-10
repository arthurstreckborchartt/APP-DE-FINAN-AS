import type { Transaction, TransactionKind } from './types'

export type TransactionFilters = {
  kind?: TransactionKind
  accountId?: string
  categoryId?: string
  search?: string
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function filterTransactions(
  list: Transaction[],
  filters: TransactionFilters,
  labelOf: (categoryId: string) => string,
): Transaction[] {
  const q = filters.search ? normalize(filters.search) : ''
  return list.filter(
    (tx) =>
      (!filters.kind || tx.kind === filters.kind) &&
      (!filters.accountId || tx.account_id === filters.accountId) &&
      (!filters.categoryId || tx.category_id === filters.categoryId) &&
      (!q || normalize(tx.description).includes(q) || normalize(labelOf(tx.category_id)).includes(q)),
  )
}

export type DayGroup = { date: string; items: Transaction[] }

export function groupByDate(list: Transaction[]): DayGroup[] {
  const byDate = new Map<string, Transaction[]>()
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
