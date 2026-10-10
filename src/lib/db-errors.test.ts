import { expect, test } from 'vitest'
import { isForeignKeyViolation } from './db-errors'

test('23503 é violação de chave estrangeira', () => expect(isForeignKeyViolation({ code: '23503' })).toBe(true))
test('outros códigos não são', () => expect(isForeignKeyViolation({ code: '23514' })).toBe(false))
test('valores não-objeto não são', () => {
  expect(isForeignKeyViolation(null)).toBe(false)
  expect(isForeignKeyViolation('23503')).toBe(false)
})
