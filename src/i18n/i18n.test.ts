import { describe, expect, test } from 'vitest'
import ptBR from './locales/pt-BR.json'
import ptPT from './locales/pt-PT.json'
import en from './locales/en.json'
import es from './locales/es.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  ).sort()
}

describe('traduções', () => {
  const base = keys(ptBR)
  test.each([['pt-PT', ptPT], ['en', en], ['es', es]])('%s tem as mesmas chaves que pt-BR', (_n, dict) =>
    expect(keys(dict)).toEqual(base))
  test('nenhum valor vazio', () => {
    for (const dict of [ptBR, ptPT, en, es]) {
      const flat = JSON.stringify(dict)
      expect(flat).not.toMatch(/:""/)
    }
  })
})
