import type { Transaction, TransactionKind } from './types'

export function mostFrequent(ids: string[]): string | undefined {
  const counts = new Map<string, number>()
  let best: string | undefined
  let bestCount = 0
  for (const id of ids) {
    const c = (counts.get(id) ?? 0) + 1
    counts.set(id, c)
    if (c > bestCount) {
      best = id
      bestCount = c
    }
  }
  return best
}

/** Conta e categoria sugeridas para um novo lançamento, a partir dos últimos lançamentos. */
export function pickDefaults(
  recent: Transaction[],
  kind: TransactionKind,
  activeAccountIds: string[],
  activeCategoryIds: string[],
): { accountId: string | null; categoryId: string | null } {
  const ofKind = recent.filter((t) => t.kind === kind)
  // Compras no cartão não têm conta e ficam fora da sugestão.
  const activeAccount = (id: string | null): id is string => id !== null && activeAccountIds.includes(id)
  const accountId =
    mostFrequent(ofKind.map((t) => t.account_id).filter(activeAccount)) ??
    mostFrequent(recent.map((t) => t.account_id).filter(activeAccount)) ??
    activeAccountIds[0] ??
    null
  const categoryId =
    mostFrequent(ofKind.map((t) => t.category_id).filter((id) => activeCategoryIds.includes(id))) ?? null
  return { accountId, categoryId }
}
