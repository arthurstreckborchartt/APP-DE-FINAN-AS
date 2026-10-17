import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroCard } from './HeroCard'
import { Ring } from './Ring'

test('o rótulo dá nome à seção e o anel e a legenda aparecem', () => {
  render(
    <HeroCard value={<span>R$ 100,00</span>} label="Restante" caption="40% usado"
      ring={<Ring value={0.4} ariaLabel="40% usado" />}>
      <button type="button">Ação</button>
    </HeroCard>,
  )
  expect(screen.getByRole('region', { name: 'Restante' })).toBeInTheDocument()
  expect(screen.getByText('R$ 100,00')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '40% usado' })).toBeInTheDocument()
  expect(screen.getByText('40% usado', { selector: 'p' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ação' })).toBeInTheDocument()
})
