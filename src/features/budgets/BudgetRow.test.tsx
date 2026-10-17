import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '../../i18n'
import i18n from '../../i18n'
import { setHideValues } from '../../lib/privacy'
import type { Category } from '../categories/types'
import { BudgetRow } from './BudgetRow'

const category: Category = {
  id: 'c1', user_id: null, kind: 'expense', name: null, i18n_key: 'food', icon: 'utensils',
  color: '#f97316', position: 0, archived: false, created_at: '', updated_at: '',
}

function renderRow(spent: number, limit = 10000, onClick?: () => void) {
  return render(<BudgetRow category={category} spent={spent} limit={limit} currency="BRL" locale="pt-BR" onClick={onClick} />)
}

const bar = (container: HTMLElement) => container.querySelector('[data-level]') as HTMLElement

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

afterEach(() => {
  act(() => setHideValues(false))
})

test('abaixo de 80%: nível ok, barra primary, sem pílula e "Faltam"', () => {
  const { container } = renderRow(5000)
  expect(bar(container).dataset.level).toBe('ok')
  expect(bar(container).className).toContain('bg-primary')
  expect(bar(container).style.width).toBe('50%')
  expect(screen.queryByText('Perto do limite')).toBeNull()
  expect(screen.queryByText('Acima do limite')).toBeNull()
  expect(screen.getByText('50%')).toBeTruthy()
  expect(screen.getByText(/Faltam/).textContent).toMatch(/Faltam R\$\s?50,00/)
  expect(screen.getByText('de').textContent).toMatch(/R\$\s?50,00 de R\$\s?100,00/)
})

test('entre 80% e 100%: nível warn com pílula "Perto do limite"', () => {
  const { container } = renderRow(8500)
  expect(bar(container).dataset.level).toBe('warn')
  expect(bar(container).className).toContain('bg-warning')
  expect(screen.getByText('Perto do limite')).toBeTruthy()
  expect(screen.getByText('85%')).toBeTruthy()
})

test('passou do limite: nível over, barra cheia, pílula e texto "Passou"', () => {
  const { container } = renderRow(15000)
  expect(bar(container).dataset.level).toBe('over')
  expect(bar(container).className).toContain('bg-danger')
  expect(bar(container).style.width).toBe('100%')
  expect(screen.getByText('Acima do limite')).toBeTruthy()
  expect(screen.getByText('150%')).toBeTruthy()
  expect(screen.getByText(/Passou/).textContent).toMatch(/Passou R\$\s?50,00/)
})

test('valores ocultos mascaram os Amount, mas o percentual continua visível', () => {
  act(() => setHideValues(true))
  renderRow(15000)
  expect(screen.queryByText(/R\$/)).toBeNull()
  expect(screen.getAllByText('••••').length).toBe(3)
  expect(screen.getByText('150%')).toBeTruthy()
  expect(screen.getByText(/Passou/)).toBeTruthy()
})

test('com onClick a linha é um botão; sem ele, só leitura', () => {
  const onClick = vi.fn()
  const { unmount } = renderRow(1000, 10000, onClick)
  fireEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
  unmount()
  renderRow(1000)
  expect(screen.queryByRole('button')).toBeNull()
})
