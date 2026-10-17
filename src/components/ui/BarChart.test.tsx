import { expect, test } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BarChart } from './BarChart'

const labels = ['ago.', 'set.', 'out.']
const series = [
  { name: 'Receitas', color: 'var(--success)', values: [500000, 650000, 700000] },
  { name: 'Despesas', color: 'var(--primary)', values: [320000, 410000, 250000] },
]
const format = (v: number) => `R$ ${(v / 100).toFixed(2)}`

test('renderiza N grupos × M barras, rótulos e legenda', () => {
  const { container } = render(<BarChart labels={labels} series={series} format={format} ariaLabel="Receitas × despesas" />)
  expect(container.querySelectorAll('path[data-bar]')).toHaveLength(6)
  expect(screen.getByRole('img', { name: 'Receitas × despesas' })).toBeTruthy()
  expect(screen.getAllByText('out.').length).toBeGreaterThanOrEqual(1)
  // Legenda com duas séries (e os cabeçalhos da tabela).
  expect(screen.getAllByText('Receitas').length).toBeGreaterThanOrEqual(2)
})

test('uma série: sem legenda', () => {
  const { container } = render(<BarChart labels={labels} series={[series[0]]} format={format} ariaLabel="x" />)
  expect(container.querySelectorAll('path[data-bar]')).toHaveLength(3)
  expect(container.querySelector('ul')).toBeNull()
})

test('balão aparece no foco e as setas mudam de grupo', () => {
  render(<BarChart labels={labels} series={series} format={format} titles={['agosto', 'setembro', 'outubro']} ariaLabel="x" />)
  const chart = screen.getByRole('img')
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.focus(chart)
  const tip = screen.getByRole('tooltip')
  expect(within(tip).getByText('outubro')).toBeTruthy()
  expect(within(tip).getByText('R$ 7000.00')).toBeTruthy()
  expect(within(tip).getByText('R$ 2500.00')).toBeTruthy()
  fireEvent.keyDown(chart, { key: 'ArrowLeft' })
  expect(within(screen.getByRole('tooltip')).getByText('setembro')).toBeTruthy()
  fireEvent.blur(chart)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('a tabela de dados acompanha o gráfico', () => {
  render(<BarChart labels={labels} series={series} format={format} ariaLabel="Receitas × despesas" />)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(4)
  expect(within(table).getByText('R$ 6500.00')).toBeTruthy()
})

test('valores ocultos: balão e tabela mascarados, sem rótulos no eixo', () => {
  const { container } = render(<BarChart labels={labels} series={series} format={format} hidden ariaLabel="x" />)
  expect(container.querySelectorAll('svg text')).toHaveLength(0)
  expect(container.textContent).not.toContain('R$')
  fireEvent.focus(screen.getByRole('img'))
  expect(within(screen.getByRole('tooltip')).getAllByText('••••')).toHaveLength(2)
  expect(within(screen.getByRole('table')).getAllByText('••••')).toHaveLength(6)
})

test('com valores visíveis, o eixo Y mostra rótulos formatados', () => {
  const { container } = render(<BarChart labels={labels} series={series} format={format} ariaLabel="x" />)
  expect(container.querySelectorAll('svg text').length).toBeGreaterThanOrEqual(3)
})
