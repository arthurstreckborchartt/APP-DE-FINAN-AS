import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { afterDeleteTransaction, toMonthEntry } from './api'

test('após excluir, remove a query "one" do id e invalida as demais', async () => {
  const qc = new QueryClient()
  qc.setQueryData(['transactions', 'u', 'one', 'a'], { id: 'a' })
  qc.setQueryData(['transactions', 'u', 'one', 'b'], { id: 'b' })
  qc.setQueryData(['transactions', 'u', 'month', '2026-10'], [])
  qc.setQueryData(['accounts', 'u'], [])
  qc.setQueryData(['cards', 'u'], [])
  qc.setQueryData(['invoices', 'u', 'unpaid'], [])
  await afterDeleteTransaction(qc, 'a')
  expect(qc.getQueryData(['transactions', 'u', 'one', 'a'])).toBeUndefined()
  expect(qc.getQueryState(['transactions', 'u', 'one', 'b'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['transactions', 'u', 'month', '2026-10'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['accounts', 'u'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['cards', 'u'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['invoices', 'u', 'unpaid'])?.isInvalidated).toBe(true)
})

test('toMonthEntry usa o id do lançamento, o valor da parcela e a data da entrada', () => {
  const entry = toMonthEntry({
    entry_id: 'inst2', transaction_id: 'tx1', user_id: 'u', kind: 'expense', amount: 3333, currency: 'BRL',
    month: '2026-11-01', date: '2026-11-10', purchase_date: '2026-10-10', category_id: 'c1', description: 'TV',
    account_id: null, card_id: 'k1', installment_number: 2, installments_count: 3, total_amount: 10000,
    created_at: '2026-10-10T12:00:00Z',
  })
  expect(entry).toMatchObject({
    id: 'tx1', entry_id: 'inst2', transaction_id: 'tx1', amount: 3333, total_amount: 10000,
    date: '2026-11-10', purchase_date: '2026-10-10', card_id: 'k1', account_id: null,
    installment_number: 2, installments_count: 3, updated_at: '2026-10-10T12:00:00Z',
  })
  expect(entry).not.toHaveProperty('month')
})
