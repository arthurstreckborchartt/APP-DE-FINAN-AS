import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../features/auth/auth-context'
import { useProfile } from '../features/profile/api'
import { FullScreenSpinner } from '../components/ui/Spinner'

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
  const { data: profile, isPending } = useProfile()
  if (isPending) return <FullScreenSpinner />
  if (!profile?.onboarded_at) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
