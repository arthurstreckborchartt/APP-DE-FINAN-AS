import { expect, test } from 'vitest'
import type { AccountWithBalance } from './types'
import { balancesByCurrency } from './totals'

function acc(p: Partial<AccountWithBalance>): AccountWithBalance {
  return {
    id: 'a', user_id: 'u', name: 'A', type: 'cash', currency: 'BRL', initial_balance: 0, archived: false,
    created_at: '', updated_at: '', balance: 0, ...p,
  }
}

test('soma saldos por moeda e ignora arquivadas', () => {
  expect(
    balancesByCurrency([
      acc({ balance: 1000, currency: 'EUR' }),
      acc({ balance: 500, currency: 'BRL' }),
      acc({ balance: 250, currency: 'EUR' }),
      acc({ balance: 9999, currency: 'EUR', archived: true }),
    ]),
  ).toEqual([
    { currency: 'BRL', total: 500 },
    { currency: 'EUR', total: 1250 },
  ])
})
