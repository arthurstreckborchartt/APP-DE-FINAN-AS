import { describe, expect, test } from 'vitest'
import { cumulative, dailyBalance, dailyExpenses, daysInMonth } from './series'
import type { Transaction } from './types'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'id', user_id: 'u', kind: 'expense', amount: 100, currency: 'BRL', date: '2026-10-01',
    category_id: 'c', description: '', account_id: 'a1', card_id: null, installments_count: 1,
    recurring_id: null, created_at: '', updated_at: '', ...p,
  }
}

describe('séries do mês', () => {
  test('dias do mês', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-10')).toBe(31)
  })

  test('gastos por dia somam só despesas da moeda', () => {
    const r = dailyExpenses([
      tx({ date: '2026-02-01', amount: 100 }),
      tx({ date: '2026-02-01', amount: 50, card_id: 'k', account_id: null }),
      tx({ date: '2026-02-03', amount: 30 }),
      tx({ date: '2026-02-03', kind: 'income', amount: 999 }),
      tx({ date: '2026-02-03', amount: 7, currency: 'EUR' }),
    ], '2026-02', 'BRL')
    expect(r).toHaveLength(28)
    expect(r.slice(0, 4)).toEqual([150, 0, 30, 0])
  })

  test('acumulado', () => expect(cumulative([1, 0, 2, 3])).toEqual([1, 1, 3, 6]))

  test('saldo dia a dia termina no saldo atual e ignora cartão e outras moedas', () => {
    const r = dailyBalance({
      currentBalance: 10000,
      month: '2026-02',
      currency: 'BRL',
      entries: [
        tx({ date: '2026-02-02', kind: 'income', amount: 5000 }),
        tx({ date: '2026-02-03', amount: 1000 }),
        tx({ date: '2026-02-03', amount: 400, card_id: 'k', account_id: null }),
        tx({ date: '2026-02-04', amount: 300, currency: 'EUR' }),
      ],
      payments: [{ date: '2026-02-05', amount: 2000, currency: 'BRL' }],
    })
    // início = 10000 − (5000 − 1000 − 2000) = 8000
    expect(r.slice(0, 6)).toEqual([8000, 13000, 12000, 12000, 10000, 10000])
    expect(r[r.length - 1]).toBe(10000)
  })
})
