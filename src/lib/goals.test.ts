import { describe, expect, it } from 'vitest'
import { goalPlan } from './goals'

const TODAY = '2026-10-17'

describe('goalPlan', () => {
  it('sem prazo: perMonth e monthsLeft nulos', () => {
    expect(goalPlan(10000, 2500, TODAY, null)).toEqual({
      remaining: 7500, pct: 25, reached: false, monthsLeft: null, perMonth: null, overdue: false,
    })
  })
  it('prazo no mês atual: monthsLeft = 1', () => {
    const p = goalPlan(10000, 2500, TODAY, '2026-10-31')
    expect(p.monthsLeft).toBe(1)
    expect(p.perMonth).toBe(7500)
    expect(p.overdue).toBe(false)
  })
  it('prazo hoje ainda conta o mês atual', () => {
    expect(goalPlan(10000, 0, TODAY, TODAY).monthsLeft).toBe(1)
  })
  it('prazo em 3 meses (inclui o atual) com ceil', () => {
    const p = goalPlan(10000, 0, TODAY, '2026-12-05')
    expect(p.monthsLeft).toBe(3)
    expect(p.perMonth).toBe(3334)
  })
  it('prazo na virada de ano', () => {
    expect(goalPlan(10000, 0, TODAY, '2027-02-01').monthsLeft).toBe(5)
  })
  it('prazo passado: overdue, monthsLeft 0, perMonth nulo', () => {
    const p = goalPlan(10000, 1000, TODAY, '2026-10-16')
    expect(p).toMatchObject({ overdue: true, monthsLeft: 0, perMonth: null, remaining: 9000 })
  })
  it('atingida: reached, remaining 0, pct 100, sem perMonth nem atraso', () => {
    const p = goalPlan(10000, 12000, TODAY, '2026-01-01')
    expect(p).toMatchObject({ reached: true, remaining: 0, pct: 100, perMonth: null, overdue: false })
  })
  it('pct arredonda para baixo e não chega a 100 sem atingir', () => {
    expect(goalPlan(10000, 9999, TODAY, null).pct).toBe(99)
  })
})
