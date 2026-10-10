import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../features/auth/auth-context'
import { useProfile } from '../features/profile/api'
import { FullScreenSpinner } from '../components/ui/Spinner'
import { ProfileErrorState } from './ProfileErrorState'

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (session) return <Navigate to="/" replace />
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
