import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './errors'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError(t('auth.errors.weakPassword'))
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return setError(t(authErrorKey(error.code)))
      navigate('/', { replace: true })
    } catch {
      setError(t('auth.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('auth.reset.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label={t('auth.fields.newPassword')} type="password" autoComplete="new-password" minLength={8}
          required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" full loading={loading}>{t('auth.reset.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
