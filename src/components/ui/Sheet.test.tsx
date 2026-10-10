import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../i18n'
import { Sheet } from './Sheet'

function setup(open = true, onClose = vi.fn()) {
  render(
    <Sheet open={open} onClose={onClose} title="Title">
      <input aria-label="first" />
      <button type="button">last</button>
    </Sheet>,
  )
  return onClose
}

describe('Sheet', () => {
  test('não renderiza nada quando fechado', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('Esc chama onClose', async () => {
    const onClose = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('foca o primeiro campo ao abrir', () => {
    setup()
    expect(screen.getByLabelText('first')).toHaveFocus()
  })

  test('Tab do último volta ao primeiro e Shift+Tab do primeiro vai ao último', async () => {
    setup()
    const close = screen.getByRole('button', { name: 'Close' })
    const last = screen.getByRole('button', { name: 'last' })
    last.focus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  test('a armadilha de foco ignora elementos com tabindex -1 nas pontas', async () => {
    render(
      <Sheet open onClose={vi.fn()} title="Title">
        <input aria-label="first" />
        <button type="button">last</button>
        <button type="button" tabIndex={-1}>skipped</button>
      </Sheet>,
    )
    screen.getByRole('button', { name: 'last' }).focus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })
})
