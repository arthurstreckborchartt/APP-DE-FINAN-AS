import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { afterDeleteTransaction } from './api'

test('após excluir, remove a query "one" do id e invalida as demais', async () => {
  const qc = new QueryClient()
  qc.setQueryData(['transactions', 'u', 'one', 'a'], { id: 'a' })
  qc.setQueryData(['transactions', 'u', 'one', 'b'], { id: 'b' })
  qc.setQueryData(['transactions', 'u', 'month', '2026-10'], [])
  qc.setQueryData(['accounts', 'u'], [])
  await afterDeleteTransaction(qc, 'a')
  expect(qc.getQueryData(['transactions', 'u', 'one', 'a'])).toBeUndefined()
  expect(qc.getQueryState(['transactions', 'u', 'one', 'b'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['transactions', 'u', 'month', '2026-10'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['accounts', 'u'])?.isInvalidated).toBe(true)
})
