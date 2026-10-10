import type { AccountWithBalance } from './types'

export function balancesByCurrency(accounts: AccountWithBalance[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>()
  for (const a of accounts) {
    if (a.archived) continue
    totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.balance)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, total }))
}
