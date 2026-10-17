import { useQuery } from '@tanstack/react-query'

export type AuthProviders = { google: boolean }

const NONE: AuthProviders = { google: false }

/** Lê do Supabase quais logins externos estão ligados. Qualquer falha conta como "nenhum". */
export async function fetchAuthProviders(): Promise<AuthProviders> {
  const url = import.meta.env.VITE_SUPABASE_URL
  const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !apikey) return NONE
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey } })
    if (!res.ok) return NONE
    const body = (await res.json()) as { external?: { google?: unknown } }
    return { google: body.external?.google === true }
  } catch {
    return NONE
  }
}

export function useAuthProviders(): AuthProviders {
  const { data } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: fetchAuthProviders,
    staleTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return data ?? NONE
}
