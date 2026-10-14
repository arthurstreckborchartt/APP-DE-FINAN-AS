import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRealtimeSync } from './realtime'

type FakeChannel = { topic: string; on: () => FakeChannel; subscribe: () => FakeChannel }

const groupsMock = vi.fn<() => { data: { id: string }[] | undefined }>()
const created: FakeChannel[] = []
const removed: FakeChannel[] = []

vi.mock('../features/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../features/groups/api', () => ({ useMyGroups: () => groupsMock() }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('./supabase', () => ({
  supabase: {
    realtime: { setAuth: () => Promise.resolve() },
    channel: (topic: string) => {
      const ch: FakeChannel = { topic, on: () => ch, subscribe: () => ch }
      created.push(ch)
      return ch
    },
    removeChannel: (ch: FakeChannel) => {
      removed.push(ch)
      return Promise.resolve('ok')
    },
  },
}))

const flush = () => act(async () => {})
const topics = (list: FakeChannel[]) => list.map((c) => c.topic)

beforeEach(() => {
  created.length = 0
  removed.length = 0
})
afterEach(() => vi.clearAllMocks())

test('entrar num grupo assina group:g1 sem recriar o canal do usuário', async () => {
  groupsMock.mockReturnValue({ data: [] })
  const { rerender } = renderHook(() => useRealtimeSync())
  await flush()
  expect(topics(created)).toEqual(['user:u1'])

  groupsMock.mockReturnValue({ data: [{ id: 'g1' }] })
  rerender()
  await flush()
  expect(topics(created)).toEqual(['user:u1', 'group:g1'])
  expect(removed).toEqual([])
})

test('trocar de grupo remove o antigo e assina o novo', async () => {
  groupsMock.mockReturnValue({ data: [{ id: 'g1' }] })
  const { rerender } = renderHook(() => useRealtimeSync())
  await flush()

  groupsMock.mockReturnValue({ data: [{ id: 'g2' }] })
  rerender()
  await flush()
  expect(topics(removed)).toEqual(['group:g1'])
  expect(topics(created)).toEqual(['user:u1', 'group:g1', 'group:g2'])
})

test('desmontar remove todos os canais', async () => {
  groupsMock.mockReturnValue({ data: [{ id: 'g1' }, { id: 'g2' }] })
  const { unmount } = renderHook(() => useRealtimeSync())
  await flush()
  unmount()
  expect(topics(removed).sort()).toEqual(['group:g1', 'group:g2', 'user:u1'])
})
