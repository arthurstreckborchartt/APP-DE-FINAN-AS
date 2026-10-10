import { describe, expect, test } from 'vitest'
import { appendDigit, formatAmountPlain, MAX_AMOUNT_CENTS, parseAmount, removeDigit } from './amount'

describe('teclado de valor', () => {
  test('digitar 1, 2, 3 vira 1,23', () => expect([1, 2, 3].reduce(appendDigit, 0)).toBe(123))
  test('apagar remove o último dígito', () => expect(removeDigit(123)).toBe(12))
  test('apagar em zero continua zero', () => expect(removeDigit(0)).toBe(0))
  test('não passa do máximo', () => expect(appendDigit(MAX_AMOUNT_CENTS, 9)).toBe(MAX_AMOUNT_CENTS))
})

describe('parseAmount', () => {
  test.each([
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['10', 1000],
    ['10,', 1000],
    [',5', 50],
    ['-50', -5000],
    ['  2 500,00 ', 250000],
    ['0', 0],
  ])('%s → %d', (text, cents) => expect(parseAmount(text)).toBe(cents))

  test.each([[''], ['abc'], ['1,2,3a'], ['-'], ['999999999999999']])('%s inválido', (text) =>
    expect(parseAmount(text)).toBeNull())
})

describe('formatAmountPlain', () => {
  test('pt-BR sem agrupamento', () => expect(formatAmountPlain(123456, 'pt-BR')).toBe('1234,56'))
  test('en', () => expect(formatAmountPlain(123456, 'en')).toBe('1234.56'))
  test('negativo', () => expect(formatAmountPlain(-500, 'en')).toBe('-5.00'))
})
