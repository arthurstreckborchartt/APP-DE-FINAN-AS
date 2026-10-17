import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '../../i18n'
import i18n from '../../i18n'
import { setHideValues } from '../../lib/privacy'
import { GoalCard } from './GoalCard'
import type { Goal } from './types'

const TODAY = '2026-10-17'

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', user_id: 'u1', name: 'Viagem', target_amount: 100000, currency: 'BRL', deadline: null,
    icon: 'plane', color: '#3b82f6', archived: false, created_at: '', updated_at: '',
    saved: 25000, contributions: 1, last_contribution: null, ...over,
  }
}

const renderCard = (g: Goal, onClick?: () => void) =>
  render(<GoalCard goal={g} locale="pt-BR" today={TODAY} onClick={onClick} />)

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

afterEach(() => {
  act(() => setHideValues(false))
})

test('atingida: "Meta atingida", 100% e barra cheia na cor da meta', () => {
  const { container } = renderCard(goal({ saved: 120000, deadline: '2026-01-31' }))
  expect(screen.getByText('Meta atingida')).toBeTruthy()
  expect(screen.getByText('100%')).toBeTruthy()
  const bar = container.querySelector('[data-goal-bar]') as HTMLElement
  expect(bar.style.width).toBe('100%')
  expect(bar.style.backgroundColor).toBe('rgb(59, 130, 246)')
  expect(screen.queryByText(/prazo passou/)).toBeNull()
})

test('prazo vencido: mostra a falta inteira', () => {
  renderCard(goal({ deadline: '2026-09-30' }))
  expect(screen.getByText(/O prazo passou/).textContent).toMatch(/O prazo passou — faltam R\$\s?750,00/)
  expect(screen.getByText('25%')).toBeTruthy()
})

test('com prazo futuro: valor por mês até o mês/ano do prazo', () => {
  // out, nov, dez = 3 meses; 750,00 / 3 = 250,00
  renderCard(goal({ deadline: '2026-12-10' }))
  const line = screen.getByText(/por mês até/).textContent
  expect(line).toMatch(/Guarde R\$\s?250,00 por mês até dez\.? de 2026/)
  expect(screen.getByText('de').textContent).toMatch(/R\$\s?250,00 de R\$\s?1\.000,00/)
})

test('sem prazo: "Sem prazo" e quanto falta', () => {
  renderCard(goal())
  expect(screen.getByText(/Sem prazo/).textContent).toMatch(/Sem prazo · Faltam R\$\s?750,00/)
})

test('valores ocultos mascaram os Amount, mas o percentual continua visível', () => {
  act(() => setHideValues(true))
  renderCard(goal({ deadline: '2026-12-10' }))
  expect(screen.queryByText(/R\$/)).toBeNull()
  expect(screen.getAllByText('••••').length).toBe(3)
  expect(screen.getByText('25%')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Viagem: 25%')
})

test('clique no card chama onClick', () => {
  const onClick = vi.fn()
  renderCard(goal(), onClick)
  fireEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})
