import { describe, expect, test } from 'vitest'
import { CURRENCIES, currencyName, formatMoney, formatMoneyParts } from './money'

const clean = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('formatMoney', () => {
  test('BRL em pt-BR', () => expect(clean(formatMoney(123456, 'BRL', 'pt-BR'))).toBe('R$ 1.234,56'))
  test('EUR em pt-PT', () => expect(clean(formatMoney(123456, 'EUR', 'pt-PT'))).toBe('1234,56 €'))
  test('USD em en', () => expect(formatMoney(123456, 'USD', 'en')).toBe('$1,234.56'))
  test('sem centavos arredonda', () => expect(formatMoney(123456, 'USD', 'en', 0)).toBe('$1,235'))
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

describe('formatMoneyParts', () => {
  test('símbolo antes (pt-BR) e o número sem o espaço', () => {
    expect(formatMoneyParts(146663, 'BRL', 'pt-BR')).toEqual({ sign: '', before: 'R$', number: '1.466,63', after: '' })
  })
  test('símbolo depois (pt-PT) e sinal separado', () => {
    expect(formatMoneyParts(-2450, 'EUR', 'pt-PT')).toEqual({ sign: '-', before: '', number: '24,50', after: '€' })
  })
})
