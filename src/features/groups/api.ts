import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Group, GroupEntry, GroupInput, GroupInvite, GroupMember, InvitePreview } from './types'

/** Link de convite que o admin compartilha. */
export function inviteUrl(token: string, origin = window.location.origin): string {
  return `${origin}/join/${token}`
}

/** O RLS filtra em silêncio: 0 linhas significa que não era admin (ou o grupo não existe mais). */
function assertAffected(rows: unknown[] | null) {
  if (!rows || rows.length === 0) throw new Error('group_not_changed')
}

const invalidateGroups = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ['groups'] })

/** Sair/remover/excluir muda `group_id` de lançamentos e recorrentes. */
const invalidateGroupsAndFinance = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['groups'] }),
    qc.invalidateQueries({ queryKey: ['transactions'] }),
    qc.invalidateQueries({ queryKey: ['recurring'] }),
  ])

/**
 * Quem saiu ou excluiu o grupo: tira o grupo da lista em cache na hora (a tela do grupo navega para
 * a lista sem mostrar "não encontrado") e não recarrega as consultas desse grupo, que já não são acessíveis.
 */
function dropGroup(qc: QueryClient, groupId: string, alsoFinance: boolean) {
  qc.setQueriesData<Group[]>({ queryKey: ['groups'], predicate: (q) => q.queryKey[2] === 'list' }, (old) =>
    old?.filter((g) => g.id !== groupId),
  )
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['groups'], predicate: (q) => q.queryKey[2] !== groupId }),
    qc.invalidateQueries({ queryKey: ['recurring'] }),
    ...(alsoFinance ? [qc.invalidateQueries({ queryKey: ['transactions'] })] : []),
  ])
}

export function useMyGroups() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, 'list'],
    enabled: !!user,
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase.rpc('my_groups')
      if (error) throw error
      return (data as Group[]).map((g) => ({ ...g, members: Number(g.members) }))
    },
  })
}

export function useGroupMembers(groupId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, groupId, 'members'],
    enabled: !!user && !!groupId,
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase.rpc('group_member_list', { p_group: groupId! })
      if (error) throw error
      return data as GroupMember[]
    },
  })
}

/** `month` no formato 'YYYY-MM'. */
export function useGroupEntries(groupId: string | undefined, month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, groupId, 'entries', month],
    enabled: !!user && !!groupId,
    queryFn: async (): Promise<GroupEntry[]> => {
      const { data, error } = await supabase.rpc('group_month_entries', { p_group: groupId!, p_month: `${month}-01` })
      if (error) throw error
      return (data as GroupEntry[]).map((e) => ({ ...e, amount: Number(e.amount) }))
    },
  })
}

/** Convites ativos (só o admin enxerga). */
export function useGroupInvites(groupId: string | undefined, enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, groupId, 'invites'],
    enabled: !!user && !!groupId && enabled,
    queryFn: async (): Promise<GroupInvite[]> => {
      const { data, error } = await supabase
        .from('group_invites')
        .select('*')
        .eq('group_id', groupId!)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as GroupInvite[]
    },
  })
}

/** Prévia do convite; `null` quando o token não existe. */
export function useInvitePreview(token: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id, 'invite', token],
    enabled: !!user && !!token,
    queryFn: async (): Promise<InvitePreview | null> => {
      const { data, error } = await supabase.rpc('group_invite_preview', { p_token: token! })
      if (error) throw error
      const row = (data as InvitePreview[] | null)?.[0]
      return row ? { ...row, members: Number(row.members) } : null
    },
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: GroupInput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: input.name,
        p_currency: input.currency,
        p_icon: input.icon,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => invalidateGroups(qc),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; icon?: string } }) => {
      const { data, error } = await supabase.from('groups').update(patch).eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: () => invalidateGroups(qc),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('groups').delete().eq('id', id).select('id')
      if (error) throw error
      assertAffected(data)
    },
    onSuccess: (_data, id) => dropGroup(qc, id, true),
  })
}

export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string): Promise<GroupInvite> => {
      const { data, error } = await supabase.rpc('create_group_invite', { p_group: groupId })
      if (error) throw error
      return data as GroupInvite
    },
    onSuccess: () => invalidateGroups(qc),
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.rpc('revoke_group_invite', { p_invite: inviteId })
      if (error) throw error
    },
    onSuccess: () => invalidateGroups(qc),
  })
}

export function useJoinGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc('join_group', { p_token: token })
      if (error) throw error
      return data as string
    },
    onSuccess: () => invalidateGroups(qc),
  })
}

export function useLeaveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc('leave_group', { p_group: groupId })
      if (error) throw error
    },
    // Os lançamentos de quem sai continuam no grupo; só as recorrentes deixam de ser do grupo.
    onSuccess: (_data, groupId) => dropGroup(qc, groupId, false),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_member', { p_group: groupId, p_user: userId })
      if (error) throw error
    },
    onSuccess: () => invalidateGroupsAndFinance(qc),
  })
}

export function useTransferAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase.rpc('transfer_admin', { p_group: groupId, p_user: userId })
      if (error) throw error
    },
    onSuccess: () => invalidateGroups(qc),
  })
}
