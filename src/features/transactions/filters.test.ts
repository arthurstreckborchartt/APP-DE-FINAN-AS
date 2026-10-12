import { describe, expect, test } from 'vitest'
import type { Transaction } from './types'
import { filterTransactions, groupByDate, summarizeByCurrency } from './filters'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'id', user_id: 'u', kind: 'expense', amount: 100, currency: 'BRL', date: '2026-10-05',
    category_id: 'c1', description: '', account_id: 'a1', card_id: null, installments_count: 1, created_at: '', updated_at: '', ...p,
  }
}

const labels: Record<string, string> = { c1: 'Alimentação', c2: 'Salário' }
const labelOf = (id: string) => labels[id] ?? ''

describe('filterTransactions', () => {
  const list = [
    tx({ id: '1', description: 'Almoço no Pão de Açúcar', category_id: 'c1' }),
    tx({ id: '2', kind: 'income', category_id: 'c2', account_id: 'a2' }),
  ]
  test('sem filtros devolve tudo', () => expect(filterTransactions(list, {}, labelOf)).toHaveLength(2))
  test('por tipo', () => expect(filterTransactions(list, { kind: 'income' }, labelOf).map((t) => t.id)).toEqual(['2']))
  test('por conta', () => expect(filterTransactions(list, { accountId: 'a2' }, labelOf).map((t) => t.id)).toEqual(['2']))
  test('por categoria', () => expect(filterTransactions(list, { categoryId: 'c1' }, labelOf).map((t) => t.id)).toEqual(['1']))
  test('busca ignora acento e maiúscula na descrição', () =>
    expect(filterTransactions(list, { search: 'pao de acucar' }, labelOf).map((t) => t.id)).toEqual(['1']))
  test('busca pelo nome da categoria', () =>
    expect(filterTransactions(list, { search: 'salario' }, labelOf).map((t) => t.id)).toEqual(['2']))
})

describe('groupByDate', () => {
  test('agrupa por dia, do mais recente ao mais antigo, mantendo a ordem interna', () => {
    const groups = groupByDate([
      tx({ id: 'a', date: '2026-10-01' }),
      tx({ id: 'b', date: '2026-10-05' }),
      tx({ id: 'c', date: '2026-10-01' }),
    ])
    expect(groups.map((g) => g.date)).toEqual(['2026-10-05', '2026-10-01'])
    expect(groups[1].items.map((t) => t.id)).toEqual(['a', 'c'])
  })
})

describe('summarizeByCurrency', () => {
  test('soma entradas e saídas por moeda', () => {
    const s = summarizeByCurrency([
      tx({ kind: 'income', amount: 1000, currency: 'EUR' }),
      tx({ kind: 'expense', amount: 300, currency: 'EUR' }),
      tx({ kind: 'expense', amount: 50, currency: 'BRL' }),
    ])
    expect(s).toEqual([
      { currency: 'BRL', income: 0, expense: 50, net: -50 },
      { currency: 'EUR', income: 1000, expense: 300, net: 700 },
    ])
  })
})

test('filtro por cartão', () => {
  const list = [tx({ id: '1', account_id: null, card_id: 'k1' }), tx({ id: '2' })]
  expect(filterTransactions(list, { cardId: 'k1' }, () => '').map((t) => t.id)).toEqual(['1'])
})
