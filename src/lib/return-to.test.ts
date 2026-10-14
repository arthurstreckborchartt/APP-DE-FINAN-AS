import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearReturnTo, readReturnTo, saveReturnTo } from './return-to'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
})

describe('return-to', () => {
  it('salva e lê /join/abc sem apagar', () => {
    saveReturnTo('/join/abc')
    expect(readReturnTo()).toBe('/join/abc')
    expect(readReturnTo()).toBe('/join/abc')
    clearReturnTo()
    expect(readReturnTo()).toBeNull()
  })

  it('ignora caminhos que não são de convite', () => {
    saveReturnTo('/cards')
    expect(readReturnTo()).toBeNull()
    saveReturnTo('https://x')
    expect(readReturnTo()).toBeNull()
    saveReturnTo('//evil.com/join/abc')
    expect(readReturnTo()).toBeNull()
  })

  it('expira após 24 h', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T10:00:00Z'))
    saveReturnTo('/join/abc')
    vi.setSystemTime(new Date('2026-10-14T09:59:00Z'))
    expect(readReturnTo()).toBe('/join/abc')
    vi.setSystemTime(new Date('2026-10-14T10:01:00Z'))
    expect(readReturnTo()).toBeNull()
  })

  it('não quebra quando o localStorage lança', () => {
    const boom = () => {
      throw new Error('blocked')
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)
    expect(() => saveReturnTo('/join/abc')).not.toThrow()
    expect(readReturnTo()).toBeNull()
    expect(() => clearReturnTo()).not.toThrow()
  })
})
