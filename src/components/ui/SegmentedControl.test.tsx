import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
]

function Harness() {
  const [v, setV] = useState('a')
  return <SegmentedControl value={v} options={options} onChange={setV} label="Kind" />
}

describe('SegmentedControl', () => {
  test('apenas a opção selecionada é alcançável pelo Tab', () => {
    render(<Harness />)
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('tabindex', '-1')
  })

  test('setas movem seleção e foco, com volta ao início', async () => {
    render(<Harness />)
    screen.getByRole('radio', { name: 'A' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'B' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'A' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'A' })).toHaveFocus()
  })

  test('Home e End', async () => {
    render(<Harness />)
    screen.getByRole('radio', { name: 'A' }).focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'C' })).toBeChecked()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'A' })).toHaveFocus()
  })
})
