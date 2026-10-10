import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../i18n'
import { AmountKeypad } from './AmountKeypad'

function Harness() {
  const [v, setV] = useState(0)
  return <AmountKeypad value={v} onChange={setV} currency="USD" locale="en" label="Amount" />
}

describe('AmountKeypad', () => {
  test('digitar pelos botões forma o valor da direita para a esquerda', async () => {
    render(<Harness />)
    for (const d of ['1', '2', '3']) await userEvent.click(screen.getByRole('button', { name: d }))
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$1.23')
  })

  test('botão 00 e apagar', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$5.00')
    await userEvent.click(screen.getByRole('button', { name: /delete digit/i }))
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$0.50')
  })

  test('teclado físico funciona com o visor focado', async () => {
    render(<Harness />)
    screen.getByRole('textbox', { name: 'Amount' }).focus()
    await userEvent.keyboard('42{Backspace}7')
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$0.47')
  })
})
