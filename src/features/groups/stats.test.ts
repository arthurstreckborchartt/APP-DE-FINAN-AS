import { describe, expect, it } from 'vitest'
import { groupMonthStats } from './stats'
import type { GroupEntry, GroupMember } from './types'

const member = (user_id: string, name: string, extra: Partial<GroupMember> = {}): GroupMember => ({
  user_id,
  name,
  role: 'member',
  joined_at: '2026-01-01T00:00:00Z',
  left_at: null,
  ...extra,
})

let seq = 0
const entry = (user_id: string, amount: number, extra: Partial<GroupEntry> = {}): GroupEntry => {
  seq += 1
  return {
    entry_id: `e${seq}`,
    transaction_id: `t${seq}`,
    user_id,
    kind: 'expense',
    amount,
    currency: 'BRL',
    date: '2026-10-10',
    category_id: 'food',
    category_name: null,
    category_key: 'food',
    category_icon: 'utensils',
    category_color: '#f00',
    description: '',
    is_card: false,
    installment_number: 1,
    installments_count: 1,
    created_at: '2026-10-10T00:00:00Z',
    ...extra,
  }
}

describe('groupMonthStats', () => {
  it('soma só despesas no total', () => {
    const out = groupMonthStats(
      [entry('a', 1000), entry('a', 5000, { kind: 'income' }), entry('b', 500)],
      [member('a', 'Ana'), member('b', 'Bia')],
    )
    expect(out.total).toBe(1500)
    expect(out.byMember.find((m) => m.user_id === 'a')?.amount).toBe(1000)
  })

  it('parcela conta pelo valor da entrada', () => {
    const out = groupMonthStats(
      [entry('a', 300, { is_card: true, installment_number: 2, installments_count: 3 })],
      [member('a', 'Ana')],
    )
    expect(out.total).toBe(300)
    expect(out.byMember[0].amount).toBe(300)
  })

  it('membro ativo sem gasto aparece com 0; quem saiu sem gasto não aparece', () => {
    const out = groupMonthStats(
      [entry('a', 1000)],
      [member('a', 'Ana'), member('b', 'Bia'), member('c', 'Caio', { left_at: '2026-09-01T00:00:00Z' })],
    )
    expect(out.byMember.map((m) => [m.user_id, m.amount])).toEqual([
      ['a', 1000],
      ['b', 0],
    ])
  })

  it('quem saiu com gasto aparece marcado', () => {
    const out = groupMonthStats(
      [entry('c', 200)],
      [member('a', 'Ana'), member('c', 'Caio', { left_at: '2026-10-20T00:00:00Z' })],
    )
    expect(out.byMember[0]).toMatchObject({ user_id: 'c', amount: 200, left: true, share: 100 })
    expect(out.byMember[1]).toMatchObject({ user_id: 'a', amount: 0, left: false, share: 0 })
  })

  it('ordena por valor desc e depois nome; share soma ~100', () => {
    const out = groupMonthStats(
      [entry('a', 100), entry('b', 100), entry('c', 100)],
      [member('c', 'Caio'), member('b', 'Bia'), member('a', 'Ana')],
    )
    expect(out.byMember.map((m) => m.name)).toEqual(['Ana', 'Bia', 'Caio'])
    const sum = out.byMember.reduce((s, m) => s + m.share, 0)
    expect(sum).toBeGreaterThanOrEqual(99)
    expect(sum).toBeLessThanOrEqual(101)
    expect(out.byMember.every((m) => Number.isInteger(m.share))).toBe(true)
  })

  it('total 0 deixa share 0', () => {
    const out = groupMonthStats([], [member('a', 'Ana')])
    expect(out.total).toBe(0)
    expect(out.byMember).toEqual([{ user_id: 'a', name: 'Ana', amount: 0, share: 0, left: false }])
    expect(out.byCategory).toEqual([])
  })

  it('agrega e ordena categorias (só despesas)', () => {
    const out = groupMonthStats(
      [
        entry('a', 100, { category_id: 'food' }),
        entry('b', 400, { category_id: 'home', category_key: null, category_name: 'Casa', category_icon: 'house', category_color: '#0f0' }),
        entry('a', 200, { category_id: 'food' }),
        entry('a', 999, { category_id: 'salary', kind: 'income' }),
      ],
      [member('a', 'Ana'), member('b', 'Bia')],
    )
    expect(out.byCategory).toEqual([
      { category_id: 'home', name: 'Casa', key: null, icon: 'house', color: '#0f0', amount: 400 },
      { category_id: 'food', name: null, key: 'food', icon: 'utensils', color: '#f00', amount: 300 },
    ])
  })
})
