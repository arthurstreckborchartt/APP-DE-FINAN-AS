import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import '../../i18n'
import type { Category } from '../categories/types'
import { TransactionRow } from './TransactionRow'
import type { Transaction } from './types'

const category: Category = {
  id: 'c1', user_id: 'u', kind: 'expense', name: 'Mercado', i18n_key: null, icon: 'shopping-cart',
  color: '#22c55e', position: 0, archived: false, created_at: '', updated_at: '',
}
const base: Transaction = {
  id: 'tx1', user_id: 'u', kind: 'expense', amount: 1050, currency: 'BRL', date: '2026-10-10',
  category_id: 'c1', description: '', account_id: 'a1', card_id: null, installments_count: 1, created_at: '', updated_at: '',
}

function renderRow(tx: Transaction) {
  return render(
    <MemoryRouter>
      <TransactionRow transaction={tx} category={category} locale="pt-BR" />
    </MemoryRouter>,
  )
}

test('link leva para a edição', () => {
  renderRow(base)
  expect(screen.getByRole('link').getAttribute('href')).toBe('/transactions/tx1/edit')
})

test('despesa mostra − e valor formatado', () => {
  renderRow(base)
  expect(screen.getByText(/^−.*10,50/)).toBeTruthy()
})

test('receita mostra +', () => {
  renderRow({ ...base, kind: 'income' })
  expect(screen.getByText(/^\+.*10,50/)).toBeTruthy()
})

test('sem descrição usa o rótulo da categoria; com descrição, ela vira o título', () => {
  const { unmount } = renderRow(base)
  expect(screen.getByText('Mercado')).toBeTruthy()
  unmount()
  renderRow({ ...base, description: 'Feira' })
  expect(screen.getByText('Feira')).toBeTruthy()
  expect(screen.getByText(/Mercado ·/)).toBeTruthy()
})

test('parcela de cartão mostra o selo n/total e o nome do cartão', () => {
  render(
    <MemoryRouter>
      <TransactionRow transaction={{ ...base, account_id: null, card_id: 'k1', installments_count: 6, installment_number: 3 }}
        category={category} card={{ id: 'k1', name: 'Nubank' } as never} locale="pt-BR" />
    </MemoryRouter>,
  )
  expect(screen.getByText('3/6')).toBeTruthy()
  expect(screen.getByText('Nubank')).toBeTruthy()
})

test('compra crua parcelada (sem installment_number) mostra só Nx', () => {
  renderRow({ ...base, account_id: null, card_id: 'k1', installments_count: 6 })
  expect(screen.getByText('6x')).toBeTruthy()
  expect(screen.queryByText('1/6')).toBeNull()
})
