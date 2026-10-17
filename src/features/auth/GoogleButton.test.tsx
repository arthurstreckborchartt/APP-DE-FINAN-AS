import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../i18n'
import { saveReturnTo, clearReturnTo } from '../../lib/return-to'
import { GoogleButton } from './GoogleButton'

const signInWithOAuth = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) } },
}))

const fetchMock = vi.fn()

function renderButton() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <GoogleButton />
    </QueryClientProvider>,
  )
}

function settings(google: boolean) {
  return { ok: true, json: async () => ({ external: { email: true, google } }) }
}

beforeAll(async () => { await i18n.changeLanguage('pt-BR') })

describe('GoogleButton', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-de-teste')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null })
    clearReturnTo()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test('consulta as configurações de login do Supabase com a chave pública', async () => {
    fetchMock.mockResolvedValue(settings(true))
    renderButton()
    await screen.findByRole('button', { name: 'Continuar com Google' })
    expect(fetchMock).toHaveBeenCalledWith('https://exemplo.supabase.co/auth/v1/settings', {
      headers: { apikey: 'chave-de-teste' },
    })
  })

  test('some quando o Google está desligado', async () => {
    fetchMock.mockResolvedValue(settings(false))
    renderButton()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).toBeNull()
    expect(screen.queryByText('ou')).toBeNull()
  })

  test('falha ao consultar o Supabase → sem Google', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    renderButton()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).toBeNull()
  })

  test('resposta de erro do Supabase → sem Google', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    renderButton()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).toBeNull()
  })

  test('sem convite pendente volta para o início', async () => {
    fetchMock.mockResolvedValue(settings(true))
    renderButton()
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar com Google' }))
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  })

  test('com convite pendente volta para /join/<token>', async () => {
    saveReturnTo('/join/abc123')
    fetchMock.mockResolvedValue(settings(true))
    renderButton()
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar com Google' }))
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/join/abc123` },
    })
  })

  test('erro do Supabase mostra aviso', async () => {
    fetchMock.mockResolvedValue(settings(true))
    signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'x' } })
    renderButton()
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar com Google' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
