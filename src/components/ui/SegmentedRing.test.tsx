import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ringSegments, SegmentedRing } from './SegmentedRing'

describe('ringSegments', () => {
  test('divide a circunferência na proporção, com folga entre fatias', () => {
    const arcs = ringSegments([300, 100], 400, 10)
    expect(arcs).toEqual([
      { index: 0, start: 0, length: 290 },
      { index: 1, start: 300, length: 90 },
    ])
  })

  test('ignora zeros e inválidos; uma fatia só não tem folga', () => {
    expect(ringSegments([0, 50, Number.NaN], 100, 10)).toEqual([{ index: 1, start: 0, length: 100 }])
  })

  test('sem total, nada a desenhar', () => {
    expect(ringSegments([0, 0], 100, 10)).toEqual([])
  })
})

describe('SegmentedRing', () => {
  test('desenha uma fatia por valor positivo, na cor de cada uma', () => {
    render(<SegmentedRing ariaLabel="Por membro" segments={[
      { key: 'a', value: 2, color: 'red' }, { key: 'b', value: 0, color: 'blue' }, { key: 'c', value: 1, color: 'green' },
    ]}><span>total</span></SegmentedRing>)
    expect(screen.getByRole('img', { name: 'Por membro' })).toBeInTheDocument()
    const arcs = screen.getAllByTestId('ring-segment')
    expect(arcs.map((a) => a.getAttribute('stroke'))).toEqual(['red', 'green'])
    expect(screen.getByText('total')).toBeInTheDocument()
  })

  test('sem ariaLabel é decorativo', () => {
    const { container } = render(<SegmentedRing segments={[]} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
