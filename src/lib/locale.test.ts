import { describe, expect, test } from 'vitest'
import { isLocale, normalizeLocale } from './locale'

describe('normalizeLocale', () => {
  test.each([
    ['pt-BR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-PT'],
    ['pt-AO', 'pt-PT'],
    ['pt-MZ', 'pt-PT'],
    ['en-US', 'en'],
    ['en', 'en'],
    ['es-MX', 'es'],
    ['fr-FR', 'en'],
    ['', 'pt-BR'],
    [null, 'pt-BR'],
    [undefined, 'pt-BR'],
  ])('%s → %s', (input, expected) => expect(normalizeLocale(input)).toBe(expected))
})

describe('isLocale', () => {
  test('aceita suportados', () => expect(isLocale('pt-PT')).toBe(true))
  test('rejeita outros', () => expect(isLocale('fr')).toBe(false))
})
