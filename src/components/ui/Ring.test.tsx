import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Ring, ringFraction } from './Ring'

describe('ringFraction', () => {
  test('limita a 0..1 e trata valores inválidos', () => {
    expect(ringFraction(0.25)).toBe(0.25)
    expect(ringFraction(1.8)).toBe(1)
    expect(ringFraction(-2)).toBe(0)
    expect(ringFraction(Number.NaN)).toBe(0)
    expect(ringFraction(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('Ring', () => {
  test('com ariaLabel é uma imagem acessível e mostra o centro', () => {
    render(<Ring value={0.5} ariaLabel="Gasto: 50%"><span>ícone</span></Ring>)
    expect(screen.getByRole('img', { name: 'Gasto: 50%' })).toBeInTheDocument()
    expect(screen.getByText('ícone')).toBeInTheDocument()
  })

  test('sem ariaLabel é decorativo', () => {
    const { container } = render(<Ring value={0.5} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  test('valor zero não desenha arco', () => {
    render(<Ring value={0} ariaLabel="vazio" />)
    expect(screen.queryByTestId('ring-arc')).not.toBeInTheDocument()
  })

  test('acima de 1 usa a cor de estouro', () => {
    render(<Ring value={1.4} color="green" overflowColor="red" ariaLabel="estourou" />)
    expect(screen.getByTestId('ring-arc')).toHaveAttribute('stroke', 'red')
  })

  test('abaixo de 1 usa a cor normal', () => {
    render(<Ring value={0.4} color="green" overflowColor="red" ariaLabel="ok" />)
    expect(screen.getByTestId('ring-arc')).toHaveAttribute('stroke', 'green')
  })
})
