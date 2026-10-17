import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChoiceChip, ChoiceTile } from './Chip'

test('ChoiceChip é um rádio acessível pelo rótulo e avisa a escolha', () => {
  const onChange = vi.fn()
  render(
    <fieldset>
      <ChoiceChip name="g" checked={false} onChange={onChange}>Casa</ChoiceChip>
      <ChoiceChip name="g" checked readOnly>Nenhum</ChoiceChip>
    </fieldset>,
  )
  const casa = screen.getByRole('radio', { name: 'Casa' })
  expect(casa).not.toBeChecked()
  expect(screen.getByRole('radio', { name: 'Nenhum' })).toBeChecked()
  fireEvent.click(screen.getByText('Casa'))
  expect(onChange).toHaveBeenCalledOnce()
})

test('ChoiceChip desabilitado não muda', () => {
  const onChange = vi.fn()
  render(<ChoiceChip name="g" disabled onChange={onChange}>Viagem</ChoiceChip>)
  expect(screen.getByRole('radio', { name: 'Viagem' })).toBeDisabled()
})

test('ChoiceTile aceita rótulo acessível próprio e marca ao clicar', () => {
  const onChange = vi.fn()
  render(<ChoiceTile name="icon" aria-label="Ícone 1" onChange={onChange}><svg /></ChoiceTile>)
  fireEvent.click(screen.getByRole('radio', { name: 'Ícone 1' }))
  expect(onChange).toHaveBeenCalledOnce()
})
