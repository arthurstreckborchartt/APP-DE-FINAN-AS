import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { invalidateRecurringData, shouldGenerateOnOpen } from './api'

test('gera ao abrir só uma vez por usuário', () => {
  expect(shouldGenerateOnOpen(null, undefined)).toBe(false)
  expect(shouldGenerateOnOpen(null, 'u1')).toBe(true)
  expect(shouldGenerateOnOpen('u1', 'u1')).toBe(false)
  expect(shouldGenerateOnOpen('u1', 'u2')).toBe(true)
})

test('invalida recorrentes, lançamentos, contas, cartões e faturas', async () => {
  const qc = new QueryClient()
  const keys = [['recurring', 'u'], ['transactions', 'u', 'month', '2026-10'], ['accounts', 'u'], ['cards', 'u'], ['invoices', 'u']]
  for (const k of keys) qc.setQueryData(k, [])
  qc.setQueryData(['categories', 'u'], [])
  await invalidateRecurringData(qc)
  for (const k of keys) expect(qc.getQueryState(k)?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['categories', 'u'])?.isInvalidated).toBe(false)
})
