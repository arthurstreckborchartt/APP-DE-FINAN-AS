import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import i18n from '../i18n'
import { ErrorPage } from './ErrorPage'

function Boom(): never {
  throw new Error('quebrou')
}

function renderWithError(onReload = vi.fn()) {
  const router = createMemoryRouter(
    [
      {
        errorElement: <ErrorPage onReload={onReload} />,
        children: [
          { path: '/', element: <p>tela inicial</p> },
          { path: '/quebrada', element: <Boom /> },
        ],
      },
    ],
    { initialEntries: ['/quebrada'] },
  )
  render(<RouterProvider router={router} />)
  return { router, onReload }
}

beforeAll(async () => { await i18n.changeLanguage('pt-BR') })

describe('ErrorPage', () => {
  afterEach(() => vi.restoreAllMocks())

  test('mostra a mensagem calma sem detalhes técnicos e registra no console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithError()
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByText('Tente recarregar a página. Se continuar, volte ao início.')).toBeInTheDocument()
    expect(screen.queryByText(/quebrou/)).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: 'quebrou' }))
  })

  test('"Recarregar" recarrega a página', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { onReload } = renderWithError()
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  test('"Ir para o início" volta para /', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { router } = renderWithError()
    await userEvent.click(screen.getByRole('button', { name: 'Ir para o início' }))
    expect(await screen.findByText('tela inicial')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
