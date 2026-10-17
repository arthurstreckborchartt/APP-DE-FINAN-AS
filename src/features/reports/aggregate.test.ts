import { describe, expect, it } from 'vitest'
import {
  categoryTotals, currenciesOf, memberMonthly, monthlyTotals, monthsBetween, periodMonths, type ReportEntry,
} from './aggregate'

const e = (p: Partial<ReportEntry>): ReportEntry => ({
  kind: 'expense', amount: 100, currency: 'BRL', month: '2026-10', category_id: 'food', user_id: 'a', ...p,
})

describe('monthsBetween', () => {
  it('inclusivo, atravessa o ano', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('um mês só', () => {
    expect(monthsBetween('2026-10', '2026-10')).toEqual(['2026-10'])
  })
  it('intervalo invertido é vazio', () => {
    expect(monthsBetween('2026-10', '2026-09')).toEqual([])
  })
})

describe('periodMonths', () => {
  it('last3, last6, last12 e thisYear', () => {
    expect(periodMonths('last3', '2026-10')).toEqual({ from: '2026-08', to: '2026-10' })
    expect(periodMonths('last6', '2026-10')).toEqual({ from: '2026-05', to: '2026-10' })
    expect(periodMonths('last12', '2026-10')).toEqual({ from: '2025-11', to: '2026-10' })
    expect(periodMonths('thisYear', '2026-10')).toEqual({ from: '2026-01', to: '2026-10' })
  })
})

describe('monthlyTotals', () => {
  it('meses sem lançamentos ficam com 0; ignora outra moeda', () => {
    const rows = monthlyTotals(
      [
        e({ month: '2026-08', amount: 300 }),
        e({ month: '2026-08', kind: 'income', amount: 1000 }),
        e({ month: '2026-10', amount: 50 }),
        e({ month: '2026-10', amount: 999, currency: 'EUR' }),
      ],
      ['2026-08', '2026-09', '2026-10'],
      'BRL',
    )
    expect(rows).toEqual([
      { month: '2026-08', income: 1000, expense: 300 },
      { month: '2026-09', income: 0, expense: 0 },
      { month: '2026-10', income: 0, expense: 50 },
    ])
  })
})

describe('categoryTotals', () => {
  it('só despesas, shares inteiros, ordenado desc', () => {
    const rows = categoryTotals(
      [
        e({ category_id: 'food', amount: 250 }),
        e({ category_id: 'home', amount: 600 }),
        e({ category_id: 'food', amount: 150 }),
        e({ category_id: 'salary', kind: 'income', amount: 9999 }),
        e({ category_id: 'home', amount: 9999, currency: 'EUR' }),
      ],
      'BRL',
    )
    expect(rows).toEqual([
      { category_id: 'home', amount: 600, share: 60 },
      { category_id: 'food', amount: 400, share: 40 },
    ])
  })
  it('shares arredondados', () => {
    const rows = categoryTotals([e({ category_id: 'a', amount: 2 }), e({ category_id: 'b', amount: 1 })], 'BRL')
    expect(rows.map((r) => r.share)).toEqual([67, 33])
  })
  it('sem despesas: lista vazia', () => {
    expect(categoryTotals([e({ kind: 'income' })], 'BRL')).toEqual([])
  })
})

describe('memberMonthly', () => {
  it('despesas por membro e mês, ordenado por total desc', () => {
    const rows = memberMonthly(
      [
        e({ user_id: 'a', month: '2026-09', amount: 100 }),
        e({ user_id: 'b', month: '2026-09', amount: 200 }),
        e({ user_id: 'b', month: '2026-10', amount: 300 }),
        e({ user_id: 'a', month: '2026-10', kind: 'income', amount: 5000 }),
        e({ user_id: 'a', month: '2026-10', amount: 700, currency: 'EUR' }),
      ],
      ['2026-09', '2026-10'],
      'BRL',
    )
    expect(rows).toEqual([
      { user_id: 'b', values: [200, 300], total: 500 },
      { user_id: 'a', values: [100, 0], total: 100 },
    ])
  })
})

describe('currenciesOf', () => {
  it('ordenadas por volume de despesas desc; só receita vai ao fim', () => {
    expect(
      currenciesOf([
        e({ currency: 'BRL', amount: 100 }),
        e({ currency: 'EUR', amount: 300 }),
        e({ currency: 'USD', kind: 'income', amount: 9999 }),
        e({ currency: 'BRL', amount: 100 }),
      ]),
    ).toEqual(['EUR', 'BRL', 'USD'])
  })
})
