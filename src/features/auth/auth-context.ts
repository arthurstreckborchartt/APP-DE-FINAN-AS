import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthState = { session: Session | null; user: User | null; loading: boolean }

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
