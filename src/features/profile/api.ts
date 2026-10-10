import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Profile, ProfilePatch } from './types'

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', user!.id).select().single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: (profile) => qc.setQueryData(['profile', profile.id], profile),
  })
}
