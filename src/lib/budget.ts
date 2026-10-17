export type BudgetLevel = 'ok' | 'warn' | 'over'

/** Percentual inteiro (arredondado para baixo), sem teto: 150 quando passou metade. */
export function budgetPct(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.floor((spent * 100) / limit)
}

/** ok < 80% ≤ warn < 100% ≤ over. */
export function budgetLevel(spent: number, limit: number): BudgetLevel {
  const pct = budgetPct(spent, limit)
  if (pct >= 100) return 'over'
  if (pct >= 80) return 'warn'
  return 'ok'
}

/** Soma das despesas por categoria em uma moeda (entradas de competência). */
export function spentByCategory(
  entries: { kind: 'income' | 'expense'; category_id: string; currency: string; amount: number }[],
  currency: string,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of entries) {
    if (e.kind !== 'expense' || e.currency !== currency) continue
    out.set(e.category_id, (out.get(e.category_id) ?? 0) + e.amount)
  }
  return out
}
