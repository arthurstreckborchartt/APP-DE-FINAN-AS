import { spentByCategory } from '../../lib/budget'
import type { Budget } from './types'

export type BudgetWithSpent = { budget: Budget; spent: number }

/** Orçamentos de uma moeda com o gasto do mês, do maior percentual para o menor. */
export function budgetsWithSpent(budgets: Budget[], entries: Parameters<typeof spentByCategory>[0], currency: string): BudgetWithSpent[] {
  const spent = spentByCategory(entries, currency)
  return budgets
    .filter((b) => b.currency === currency)
    .map((budget) => ({ budget, spent: spent.get(budget.category_id) ?? 0 }))
    .sort((a, b) => b.spent / b.budget.amount - a.spent / a.budget.amount)
}

export function budgetTotals(rows: BudgetWithSpent[]): { spent: number; limit: number } {
  return rows.reduce((acc, r) => ({ spent: acc.spent + r.spent, limit: acc.limit + r.budget.amount }), { spent: 0, limit: 0 })
}
