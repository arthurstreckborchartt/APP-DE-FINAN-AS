import { expect, test } from 'vitest'
import { expensesByCategory } from './filters'
import type { Transaction } from './types'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'id', user_id: 'u', kind: 'expense', amount: 100, currency: 'BRL', date: '2026-10-05',
    category_id: 'c1', description: '', account_id: 'a1', card_id: null, installments_count: 1, recurring_id: null, group_id: null, created_at: '', updated_at: '', ...p,
  }
}

test('soma despesas da moeda por categoria, ordena e calcula a fatia', () => {
  const r = expensesByCategory([
    tx({ category_id: 'food', amount: 300 }),
    tx({ category_id: 'home', amount: 600 }),
    tx({ category_id: 'food', amount: 100 }),
    tx({ category_id: 'salary', kind: 'income', amount: 9999 }),
    tx({ category_id: 'food', amount: 5000, currency: 'EUR' }),
  ], 'BRL')
  expect(r).toEqual([
    { categoryId: 'home', total: 600, share: 0.6 },
    { categoryId: 'food', total: 400, share: 0.4 },
  ])
})

test('sem despesas devolve lista vazia', () => expect(expensesByCategory([], 'BRL')).toEqual([]))
