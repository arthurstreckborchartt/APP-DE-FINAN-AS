import { beforeAll, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import type { Budget } from '../budgets/types'
import type { Category } from '../categories/types'
import { GroupBudgetSection } from './GroupBudgetSection'
import type { Group } from './types'

const state = vi.hoisted(() => ({ budgets: [] as unknown[] }))
const ok = (data: unknown) => ({ data, isPending: false, isError: false, refetch: () => {} })

vi.mock('../budgets/api', () => ({
  useGroupBudgets: () => ok(state.budgets),
  useCreateBudget: () => ({ mutateAsync: async () => ({}), isPending: false }),
  useUpdateBudget: () => ({ mutateAsync: async () => ({}), isPending: false }),
  useDeleteBudget: () => ({ mutateAsync: async () => ({}), isPending: false }),
}))
vi.mock('./api', () => ({ useGroupEntries: () => ok([]) }))
vi.mock('../categories/api', () => ({
  useCategories: () => ok([
    { id: 'c1', user_id: null, kind: 'expense', name: null, i18n_key: 'food', icon: 'utensils', color: '#f97316', position: 0, archived: false, created_at: '', updated_at: '' },
  ] satisfies Category[]),
}))

const group: Group = { id: 'g1', name: 'Casa', currency: 'BRL', icon: 'home', role: 'admin', members: 2, created_at: '' }
const budget: Budget = {
  id: 'b1', user_id: 'u1', group_id: 'g1', category_id: 'c1', amount: 50000, currency: 'BRL', created_at: '', updated_at: '',
}

beforeAll(async () => { await i18n.changeLanguage('pt-BR') })

test('administrador: botão de novo orçamento e linhas clicáveis', () => {
  state.budgets = [budget]
  render(<GroupBudgetSection group={group} month="2026-10" admin />)
  expect(screen.getByRole('button', { name: /Novo orçamento/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Alimentação/ }))
  expect(screen.getByText('Editar orçamento')).toBeTruthy()
})

test('membro: só leitura, sem botão nem linhas clicáveis', () => {
  state.budgets = [budget]
  render(<GroupBudgetSection group={{ ...group, role: 'member' }} month="2026-10" admin={false} />)
  expect(screen.getByText('Alimentação')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

test('vazio: texto do membro difere do administrador, que ganha o botão', () => {
  state.budgets = []
  const { unmount } = render(<GroupBudgetSection group={group} month="2026-10" admin={false} />)
  expect(screen.getByText('Sem orçamento no grupo.')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
  unmount()
  render(<GroupBudgetSection group={group} month="2026-10" admin />)
  expect(screen.getByText(/Defina limites mensais/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /Novo orçamento/ })).toBeTruthy()
})
