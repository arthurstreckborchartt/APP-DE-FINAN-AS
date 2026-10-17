import { describe, expect, it } from 'vitest'
import { budgetLevel, budgetPct, spentByCategory } from './budget'

describe('budgetPct', () => {
  it('zero, abaixo e acima do limite (sem teto)', () => {
    expect(budgetPct(0, 100)).toBe(0)
    expect(budgetPct(79, 100)).toBe(79)
    expect(budgetPct(150, 100)).toBe(150)
  })
  it('arredonda para baixo', () => {
    expect(budgetPct(7999, 10000)).toBe(79)
  })
})

describe('budgetLevel', () => {
  it('limites 79/80/99/100', () => {
    expect(budgetLevel(79, 100)).toBe('ok')
    expect(budgetLevel(80, 100)).toBe('warn')
    expect(budgetLevel(99, 100)).toBe('warn')
    expect(budgetLevel(100, 100)).toBe('over')
  })
  it('79,99% ainda é ok', () => {
    expect(budgetLevel(7999, 10000)).toBe('ok')
  })
})

describe('spentByCategory', () => {
  it('ignora receitas e outras moedas e soma parcelas', () => {
    const m = spentByCategory(
      [
        { kind: 'expense', category_id: 'food', currency: 'BRL', amount: 1000 },
        { kind: 'expense', category_id: 'food', currency: 'BRL', amount: 2500 },
        { kind: 'expense', category_id: 'food', currency: 'EUR', amount: 9999 },
        { kind: 'income', category_id: 'food', currency: 'BRL', amount: 5000 },
        { kind: 'expense', category_id: 'home', currency: 'BRL', amount: 300 },
      ],
      'BRL',
    )
    expect(m.get('food')).toBe(3500)
    expect(m.get('home')).toBe(300)
    expect(m.size).toBe(2)
  })
})
