import { StrictMode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import { InviteSheet } from './InviteSheet'
import type { Group, GroupInvite } from './types'

const state = vi.hoisted(() => ({
  invites: { isPending: false, isSuccess: true, isError: false, data: [] as unknown[], refetch: () => {} },
  create: { mutate: (() => {}) as (...args: unknown[]) => void, mutateAsync: async () => ({}), isPending: false, data: undefined as unknown },
}))

vi.mock('./api', () => ({
  inviteUrl: (token: string) => `https://app.test/join/${token}`,
  useGroupInvites: () => state.invites,
  useCreateInvite: () => state.create,
  useRevokeInvite: () => ({ mutateAsync: async () => {}, isPending: false }),
}))

const group: Group = { id: 'g1', name: 'Casa', currency: 'BRL', icon: 'home', role: 'admin', members: 2, created_at: '' }
const invite: GroupInvite = {
  id: 'i1', group_id: 'g1', token: 'tok123', expires_at: '2026-10-20T00:00:00Z', revoked_at: null, created_at: '',
}

const t = (key: string) => i18n.t(key)

describe('InviteSheet', () => {
  beforeEach(() => {
    state.invites = { isPending: false, isSuccess: true, isError: false, data: [], refetch: () => {} }
    state.create = { mutate: vi.fn(), mutateAsync: async () => ({}), isPending: false, data: undefined }
  })

  test('sem link ativo cria um convite uma única vez (mesmo no StrictMode)', () => {
    const mutate = vi.fn()
    state.create.mutate = mutate
    const { rerender } = render(<StrictMode><InviteSheet open onClose={() => {}} group={group} /></StrictMode>)
    rerender(<StrictMode><InviteSheet open onClose={() => {}} group={group} /></StrictMode>)
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith('g1', expect.anything())
  })

  test('sem link ativo e nada carregando: mostra o aviso e "Gerar novo link", não o spinner', () => {
    render(<InviteSheet open onClose={() => {}} group={group} />)
    expect(screen.getByText(t('groups.noActiveInvite'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('groups.newInvite') })).toBeEnabled()
    expect(document.querySelector('.animate-spin')).toBeNull()
    expect(screen.queryByRole('button', { name: t('groups.copyLink') })).not.toBeInTheDocument()
  })

  test('criando o convite: mostra o spinner', () => {
    state.create = { ...state.create, isPending: true }
    render(<InviteSheet open onClose={() => {}} group={group} />)
    expect(document.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText(t('groups.noActiveInvite'))).not.toBeInTheDocument()
  })

  test('com link ativo mostra o endereço e não cria outro', () => {
    const mutate = vi.fn()
    state.create.mutate = mutate
    state.invites = { ...state.invites, data: [invite] }
    render(<InviteSheet open onClose={() => {}} group={group} />)
    expect(screen.getByDisplayValue('https://app.test/join/tok123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('groups.copyLink') })).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })
})
