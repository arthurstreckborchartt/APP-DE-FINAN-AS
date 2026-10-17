import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import i18n from '../../i18n'
import { monthOf, todayISO } from '../../lib/dates'
import ReportsPage from './ReportsPage'

const ok = (data: unknown) => ({ data, isPending: false, isError: false, refetch: () => {} })
const month = monthOf(todayISO())
const entry = (kind: string, amount: number, currency: string, extra = {}) => ({
  kind, amount, currency, month, category_id: kind === 'income' ? 'c-sal' : 'c-food', account_id: 'a1', card_id: null, ...extra,
})

const privacy = vi.hoisted(() => ({ hidden: false }))
vi.mock('../../lib/privacy', () => ({ useHideValues: () => privacy.hidden }))
vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('./api', () => ({
  useEntriesRange: () => ok([
    entry('income', 500000, 'BRL'),
    entry('expense', 120000, 'BRL'),
    entry('expense', 30000, 'BRL', { account_id: null, card_id: 'k1' }),
    entry('expense', 5000, 'EUR', { account_id: 'a2' }),
  ]),
  useGroupPeriodEntries: () => ok([
    { kind: 'expense', amount: 9000, currency: 'BRL', month, user_id: 'u1', category_id: 'c-food', category_name: null, category_key: 'food', category_icon: 'utensils', category_color: '#f97316' },
    { kind: 'expense', amount: 4000, currency: 'BRL', month, user_id: 'u2', category_id: 'c-food', category_name: null, category_key: 'food', category_icon: 'utensils', category_color: '#f97316' },
  ]),
}))
vi.mock('../groups/api', () => ({
  useMyGroups: () => ok([{ id: 'g1', name: 'Casa', currency: 'BRL', icon: 'home', role: 'admin', members: 2, created_at: '' }]),
  useGroupMembers: () => ok([
    { user_id: 'u1', name: 'Ana', role: 'admin', joined_at: '', left_at: null },
    { user_id: 'u2', name: 'Bruno', role: 'member', joined_at: '', left_at: null },
  ]),
}))
vi.mock('../accounts/api', () => ({
  useAccounts: () => ok([
    { id: 'a1', name: 'Nubank', currency: 'BRL', archived: false },
    { id: 'a2', name: 'Lisboa', currency: 'EUR', archived: false },
  ]),
}))
vi.mock('../cards/api', () => ({ useCards: () => ok([{ id: 'k1', name: 'Visa', currency: 'BRL', archived: false }]) }))
vi.mock('../categories/api', () => ({
  useCategories: () => ok([
    { id: 'c-food', user_id: null, kind: 'expense', name: null, i18n_key: 'food', icon: 'utensils', color: '#f97316', position: 0, archived: false },
    { id: 'c-sal', user_id: null, kind: 'income', name: null, i18n_key: 'salary', icon: 'briefcase', color: '#16a34a', position: 0, archived: false },
  ]),
}))

beforeAll(async () => { await i18n.changeLanguage('pt-BR') })
afterEach(() => { privacy.hidden = false })

const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><ReportsPage /></MemoryRouter>)

test('pessoal: resumo na moeda de maior despesa, gráfico e filtro por conta ou cartão', () => {
  renderAt('/reports')
  expect(screen.getByRole('radio', { name: 'Pessoal' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('img', { name: 'Receitas × despesas' })).toBeTruthy()
  expect(screen.getByRole('radio', { name: 'BRL' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByText('Saldo do período')).toBeTruthy()
  expect(screen.getAllByText(/R\$\s?3\.500,00/).length).toBeGreaterThan(0)
  // Só contas e cartões na moeda escolhida.
  const select = screen.getByLabelText('Conta ou cartão')
  expect(screen.getByRole('option', { name: 'Visa' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Lisboa' })).toBeNull()
  fireEvent.change(select, { target: { value: 'k:k1' } })
  expect(screen.getAllByText(/R\$\s?300,00/).length).toBeGreaterThan(0)
})

test('grupo: comparação entre membros e gastos por membro', () => {
  renderAt('/reports?scope=g1')
  expect(screen.getByRole('radio', { name: 'Casa' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('img', { name: 'Comparação entre membros' })).toBeTruthy()
  expect(screen.getByText('Gastos por membro')).toBeTruthy()
  expect(screen.getAllByText('Bruno').length).toBeGreaterThan(0)
  expect(screen.queryByLabelText('Conta ou cartão')).toBeNull()
})

test.each(['/reports', '/reports?scope=g1'])('ocultar valores: nenhum valor vaza em %s (resumo, eixo, balão, tabela)', (url) => {
  privacy.hidden = true
  const { container } = renderAt(url)
  const chart = screen.getByRole('img')
  expect(chart.getAttribute('aria-label')).toContain('Valores ocultos')
  fireEvent.focus(chart)
  expect(screen.getByRole('tooltip')).toBeTruthy()
  const text = container.textContent ?? ''
  expect(text).not.toMatch(/R\$|€|\d[.,]\d{2}\b|\bmil\b/)
  expect(text).toContain('••••')
})
