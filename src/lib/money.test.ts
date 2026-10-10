import { describe, expect, test } from 'vitest'
import { CURRENCIES, currencyName, formatMoney } from './money'

const clean = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('formatMoney', () => {
  test('BRL em pt-BR', () => expect(clean(formatMoney(123456, 'BRL', 'pt-BR'))).toBe('R$ 1.234,56'))
  test('EUR em pt-PT', () => expect(clean(formatMoney(123456, 'EUR', 'pt-PT'))).toBe('1234,56 €'))
  test('USD em en', () => expect(formatMoney(123456, 'USD', 'en')).toBe('$1,234.56'))
  test('negativo', () => expect(clean(formatMoney(-500, 'BRL', 'pt-BR'))).toBe('-R$ 5,00'))
  test('zero', () => expect(clean(formatMoney(0, 'EUR', 'es'))).toBe('0,00 €'))
})

describe('CURRENCIES', () => {
  test('lista fixa', () =>
    expect(CURRENCIES).toEqual(['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN']))
})

describe('currencyName', () => {
  test('nome localizado', () => expect(currencyName('BRL', 'en')).toBe('Brazilian Real'))
})
