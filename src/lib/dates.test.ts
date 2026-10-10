import { describe, expect, test } from 'vitest'
import { formatMonth, isMonth, monthOf, monthRange, relativeDay, shiftMonth, todayISO } from './dates'

describe('datas', () => {
  test('todayISO usa a data local', () => expect(todayISO(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05'))
  test('monthOf', () => expect(monthOf('2026-10-05')).toBe('2026-10'))
  test('isMonth', () => {
    expect(isMonth('2026-10')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('abc')).toBe(false)
    expect(isMonth(null)).toBe(false)
  })
  test('monthRange fevereiro comum', () => expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' }))
  test('monthRange fevereiro bissexto', () => expect(monthRange('2024-02').end).toBe('2024-02-29'))
  test('monthRange outubro', () => expect(monthRange('2026-10').end).toBe('2026-10-31'))
  test('shiftMonth volta o ano', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'))
  test('shiftMonth avança o ano', () => expect(shiftMonth('2026-12', 1)).toBe('2027-01'))
  test('formatMonth en', () => expect(formatMonth('2026-10', 'en')).toBe('October 2026'))
  test('relativeDay hoje', () => expect(relativeDay('2026-10-05', '2026-10-05')).toBe('today'))
  test('relativeDay ontem na virada do mês', () => expect(relativeDay('2026-09-30', '2026-10-01')).toBe('yesterday'))
  test('relativeDay outro dia', () => expect(relativeDay('2026-10-01', '2026-10-05')).toBeNull())
})
