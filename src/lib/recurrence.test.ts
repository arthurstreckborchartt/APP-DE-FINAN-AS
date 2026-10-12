import { describe, expect, it } from 'vitest'
import { nextOccurrence, upcomingOccurrences } from './recurrence'

describe('nextOccurrence', () => {
  it('mensal: 31/01 -> 28/02', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28')
  })
  it('mensal: volta ao dia âncora', () => {
    expect(nextOccurrence('2026-02-28', 'monthly', '2026-01-31')).toBe('2026-03-31')
  })
  it('mensal: virada de ano', () => {
    expect(nextOccurrence('2026-12-15', 'monthly', '2026-01-15')).toBe('2027-01-15')
  })
  it('semanal soma 7 dias', () => {
    expect(nextOccurrence('2026-03-10', 'weekly', '2026-03-10')).toBe('2026-03-17')
    expect(nextOccurrence('2026-12-28', 'weekly', '2026-12-28')).toBe('2027-01-04')
  })
  it('anual: 29/02 -> 28/02', () => {
    expect(nextOccurrence('2024-02-29', 'yearly', '2024-02-29')).toBe('2025-02-28')
  })
  it('anual: volta a 28/02 e depois 29/02 em bissexto', () => {
    expect(nextOccurrence('2025-02-28', 'yearly', '2024-02-29')).toBe('2026-02-28')
    expect(nextOccurrence('2027-02-28', 'yearly', '2024-02-29')).toBe('2028-02-29')
  })
})

describe('upcomingOccurrences', () => {
  const base = { next_date: '2026-01-31', frequency: 'monthly' as const, start_date: '2026-01-31', end_date: null, paused: false }
  it('lista até a data limite, inclusive', () => {
    expect(upcomingOccurrences(base, '2026-04-15')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
  it('respeita end_date', () => {
    expect(upcomingOccurrences({ ...base, end_date: '2026-02-28' }, '2026-04-15')).toEqual(['2026-01-31', '2026-02-28'])
  })
  it('pausada retorna vazio', () => {
    expect(upcomingOccurrences({ ...base, paused: true }, '2026-04-15')).toEqual([])
  })
  it('respeita limit', () => {
    expect(upcomingOccurrences(base, '2030-01-01', 2)).toEqual(['2026-01-31', '2026-02-28'])
  })
  it('limit padrão 12', () => {
    expect(upcomingOccurrences(base, '2040-01-01')).toHaveLength(12)
  })
  it('next_date após o limite retorna vazio', () => {
    expect(upcomingOccurrences(base, '2026-01-30')).toEqual([])
  })
})
