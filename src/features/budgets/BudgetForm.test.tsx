import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import type { Category } from '../categories/types'
import { BudgetForm } from './BudgetForm'

const create = vi.fn()
vi.mock('./api', () => ({
  useCreateBudget: () => ({ mutateAsync: create, isPending: false }),
  useUpdateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const cat = (id: string, user_id: string | null, i18n_key: string | null, name: string | null = null): Category => ({
  id, user_id, kind: 'expense', name, i18n_key, icon: 'utensils', color: '#f97316', position: 0, archived: false, created_at: '', updated_at: '',
})
const categories = [cat('c-food', null, 'food'), cat('c-cafe', 'u1', null, 'Café')]

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})
beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue({})
})

test('modo grupo: só categorias padrão, moeda fixa e envia o group_id', async () => {
  const onDone = vi.fn()
  render(<BudgetForm mode="group" groupId="g1" currency="EUR" existing={[]} categories={categories} onDone={onDone} />)
  expect(screen.queryByText('Café')).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.getByText('EUR')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Alimentação'))
  fireEvent.change(screen.getByLabelText('Limite por mês'), { target: { value: '150,00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(create).toHaveBeenCalledWith({ category_id: 'c-food', amount: 15000, currency: 'EUR', group_id: 'g1' })
})

test('modo pessoal: categorias próprias aparecem e group_id é null', async () => {
  const onDone = vi.fn()
  render(<BudgetForm mode="personal" currency="USD" existing={[]} categories={categories} onDone={onDone} />)
  fireEvent.click(screen.getByLabelText('Café'))
  fireEvent.change(screen.getByLabelText('Limite por mês'), { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(create).toHaveBeenCalledWith({ category_id: 'c-cafe', amount: 2000, currency: 'USD', group_id: null })
})

test('limite acima do máximo mostra erro e não envia', () => {
  render(<BudgetForm mode="personal" currency="BRL" existing={[]} categories={categories} onDone={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('Café'))
  fireEvent.change(screen.getByLabelText('Limite por mês'), { target: { value: '1000000000000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy()
  expect(create).not.toHaveBeenCalled()
})

test('o tipo exige groupId no modo grupo', () => {
  // @ts-expect-error groupId é obrigatório quando mode = 'group'
  const el = <BudgetForm mode="group" currency="BRL" existing={[]} categories={[]} onDone={() => {}} />
  expect(el).toBeTruthy()
})
