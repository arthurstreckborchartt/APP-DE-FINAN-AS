import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../features/auth/auth-context'
import { useProfile } from '../features/profile/api'
import { FullScreenSpinner } from '../components/ui/Spinner'
import { ProfileErrorState } from './ProfileErrorState'
import { readReturnTo, saveReturnTo } from '../lib/return-to'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) {
    // Link de convite aberto sem sessão: volta para ele depois de entrar (só guarda `/join/...`).
    saveReturnTo(location.pathname)
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  // Não apaga o destino aqui: a página do convite apaga ao montar (seguro no StrictMode).
  if (session) return <Navigate to={readReturnTo() ?? '/'} replace />
  return <Outlet />
}

export function RequireOnboarded() {
  const { data: profile, isPending, isError, refetch } = useProfile()
  if (isPending) return <FullScreenSpinner />
  // Um refetch em segundo plano que falha mantém os dados em cache: só mostra o erro sem perfil
  if (isError && !profile) return <ProfileErrorState onRetry={() => void refetch()} />
  if (profile && !profile.onboarded_at) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
