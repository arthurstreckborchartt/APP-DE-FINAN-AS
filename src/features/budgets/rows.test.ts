import { expect, test } from 'vitest'
import { budgetsWithSpent, budgetTotals, pickBudgetCurrency } from './rows'
import type { Budget } from './types'

const b = (id: string, category_id: string, amount: number, currency: Budget['currency']): Budget => ({
  id, user_id: 'u', group_id: null, category_id, amount, currency, created_at: '', updated_at: '',
})

test('pickBudgetCurrency: prefere a moeda do perfil quando há orçamento nela', () => {
  expect(pickBudgetCurrency([b('1', 'c', 100, 'EUR'), b('2', 'd', 50, 'BRL')], 'BRL')).toBe('BRL')
})

test('pickBudgetCurrency: sem orçamento na moeda do perfil, usa a de maior limite somado', () => {
  const budgets = [b('1', 'c', 100, 'EUR'), b('2', 'd', 80, 'USD'), b('3', 'e', 90, 'USD')]
  expect(pickBudgetCurrency(budgets, 'BRL')).toBe('USD')
  expect(pickBudgetCurrency([], 'BRL')).toBeUndefined()
})

test('budgetsWithSpent: filtra a moeda e ordena pelo maior percentual', () => {
  const entries = [
    { kind: 'expense' as const, category_id: 'a', currency: 'BRL', amount: 90 },
    { kind: 'expense' as const, category_id: 'b', currency: 'BRL', amount: 10 },
    { kind: 'expense' as const, category_id: 'b', currency: 'EUR', amount: 999 },
  ]
  const rows = budgetsWithSpent([b('1', 'b', 100, 'BRL'), b('2', 'a', 100, 'BRL'), b('3', 'a', 100, 'EUR')], entries, 'BRL')
  expect(rows.map((r) => [r.budget.id, r.spent])).toEqual([['2', 90], ['1', 10]])
  expect(budgetTotals(rows)).toEqual({ spent: 100, limit: 200 })
})
