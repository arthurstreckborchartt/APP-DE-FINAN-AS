import { describe, expect, test } from 'vitest'
import type { Transaction } from './types'
import { mostFrequent, pickDefaults } from './defaults'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'id', user_id: 'u', kind: 'expense', amount: 100, currency: 'BRL', date: '2026-10-05',
    category_id: 'c1', description: '', account_id: 'a1', created_at: '', updated_at: '', ...p,
  }
}

describe('mostFrequent', () => {
  test('o mais repetido', () => expect(mostFrequent(['a', 'b', 'b'])).toBe('b'))
  test('empate fica com o primeiro visto', () => expect(mostFrequent(['a', 'b'])).toBe('a'))
  test('lista vazia', () => expect(mostFrequent([])).toBeUndefined())
})

describe('pickDefaults', () => {
  const recent = [
    tx({ account_id: 'a2', category_id: 'c2' }),
    tx({ account_id: 'a2', category_id: 'c2' }),
    tx({ account_id: 'a1', category_id: 'c1' }),
    tx({ kind: 'income', account_id: 'a3', category_id: 'i1' }),
  ]
  test('usa a conta e a categoria mais usadas do tipo', () =>
    expect(pickDefaults(recent, 'expense', ['a1', 'a2', 'a3'], ['c1', 'c2'])).toEqual({ accountId: 'a2', categoryId: 'c2' }))
  test('ignora contas e categorias inativas', () =>
    expect(pickDefaults(recent, 'expense', ['a1'], ['c1'])).toEqual({ accountId: 'a1', categoryId: 'c1' }))
  test('sem histórico usa a primeira conta ativa e nenhuma categoria', () =>
    expect(pickDefaults([], 'income', ['a9'], ['i1'])).toEqual({ accountId: 'a9', categoryId: null }))
  test('sem contas', () => expect(pickDefaults([], 'expense', [], [])).toEqual({ accountId: null, categoryId: null }))
})
