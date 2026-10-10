import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '../i18n'
import type { Profile } from '../features/profile/types'
import { RequireOnboarded } from './guards'

const useProfileMock = vi.fn()

vi.mock('../features/profile/api', () => ({ useProfile: () => useProfileMock() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: vi.fn() }) }))

const PROFILE: Profile = {
  id: 'u1', name: 'Ana', locale: 'pt-BR', currency: 'BRL', theme: 'system',
  onboarded_at: '2026-10-10T00:00:00Z', created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z',
}

function renderGuard() {
  const router = createMemoryRouter(
    [
      { element: <RequireOnboarded />, children: [{ path: '/', element: <p>conteúdo protegido</p> }] },
      { path: '/onboarding', element: <p>tela de onboarding</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

function state(partial: { data?: Profile; isPending?: boolean; isError?: boolean }) {
  return { data: undefined, isPending: false, isError: false, refetch: vi.fn(), ...partial }
}

describe('RequireOnboarded', () => {
  beforeEach(() => useProfileMock.mockReset())

  test('carregando mostra o spinner', () => {
    useProfileMock.mockReturnValue(state({ isPending: true }))
    renderGuard()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo protegido')).toBeNull()
  })

  test('erro sem dados mostra o estado de erro', () => {
    useProfileMock.mockReturnValue(state({ isError: true }))
    renderGuard()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo protegido')).toBeNull()
  })

  test('erro de refetch com perfil em cache continua mostrando o conteúdo', () => {
    useProfileMock.mockReturnValue(state({ isError: true, data: PROFILE }))
    renderGuard()
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('perfil sem onboarding redireciona para /onboarding', () => {
    useProfileMock.mockReturnValue(state({ data: { ...PROFILE, onboarded_at: null } }))
    renderGuard()
    expect(screen.getByText('tela de onboarding')).toBeInTheDocument()
  })
})
