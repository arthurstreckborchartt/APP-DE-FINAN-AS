import { expect, test } from 'vitest'
import { isForeignKeyViolation, isPaidInvoiceError, isRpcHint } from './db-errors'

test('23503 é violação de chave estrangeira', () => expect(isForeignKeyViolation({ code: '23503' })).toBe(true))
test('outros códigos não são', () => expect(isForeignKeyViolation({ code: '23514' })).toBe(false))
test('valores não-objeto não são', () => {
  expect(isForeignKeyViolation(null)).toBe(false)
  expect(isForeignKeyViolation('23503')).toBe(false)
})

test('23514 com hint paid_invoice é erro de fatura paga', () =>
  expect(isPaidInvoiceError({ code: '23514', hint: 'paid_invoice' })).toBe(true))
test('23514 com outro hint ou sem hint não é', () => {
  expect(isPaidInvoiceError({ code: '23514', hint: 'archived_card' })).toBe(false)
  expect(isPaidInvoiceError({ code: '23514' })).toBe(false)
})
test('outro código com hint paid_invoice não é', () =>
  expect(isPaidInvoiceError({ code: '23503', hint: 'paid_invoice' })).toBe(false))
test('valores não-objeto não são erro de fatura paga', () => {
  expect(isPaidInvoiceError(null)).toBe(false)
  expect(isPaidInvoiceError(undefined)).toBe(false)
  expect(isPaidInvoiceError('paid_invoice')).toBe(false)
})

test('isRpcHint compara o hint do erro', () => {
  expect(isRpcHint({ code: '23514', hint: 'already_paid' }, 'already_paid')).toBe(true)
  expect(isRpcHint({ code: '23514', hint: 'empty_invoice' }, 'already_paid')).toBe(false)
  expect(isRpcHint({ code: '23514' }, 'already_paid')).toBe(false)
  expect(isRpcHint(null, 'already_paid')).toBe(false)
  expect(isRpcHint('already_paid', 'already_paid')).toBe(false)
})
