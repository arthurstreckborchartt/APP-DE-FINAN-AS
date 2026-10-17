import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChipRadioGroup, ChoiceChip, ChoiceTile } from './Chip'

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

test('ChipRadioGroup: só a marcada entra no Tab; setas, Home e End escolhem e levam o foco', () => {
  const onChange = vi.fn()
  const options = [
    { value: 'a', label: 'Pessoal', checked: true },
    { value: 'b', label: 'Casa', checked: false },
    { value: 'c', label: 'Viagem', checked: false },
  ]
  render(<ChipRadioGroup label="Ver" options={options} onChange={onChange} />)
  const group = screen.getByRole('radiogroup', { name: 'Ver' })
  expect(screen.getByRole('radio', { name: 'Pessoal' })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('radio', { name: 'Casa' })).toHaveAttribute('tabindex', '-1')
  fireEvent.keyDown(group, { key: 'ArrowRight' })
  expect(onChange).toHaveBeenLastCalledWith('b')
  expect(screen.getByRole('radio', { name: 'Casa' })).toHaveFocus()
  fireEvent.keyDown(group, { key: 'ArrowLeft' })
  expect(onChange).toHaveBeenLastCalledWith('c')
  fireEvent.keyDown(group, { key: 'End' })
  expect(onChange).toHaveBeenLastCalledWith('c')
  fireEvent.keyDown(group, { key: 'Home' })
  expect(onChange).toHaveBeenLastCalledWith('a')
})
