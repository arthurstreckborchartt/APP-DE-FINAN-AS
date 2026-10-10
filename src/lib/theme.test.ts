import { describe, expect, test } from 'vitest'
import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  test('system + escuro', () => expect(resolveTheme('system', true)).toBe('dark'))
  test('system + claro', () => expect(resolveTheme('system', false)).toBe('light'))
  test('light ignora sistema', () => expect(resolveTheme('light', true)).toBe('light'))
  test('dark ignora sistema', () => expect(resolveTheme('dark', false)).toBe('dark'))
})
