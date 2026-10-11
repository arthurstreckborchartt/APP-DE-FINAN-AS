import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './errors'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return setError(t(authErrorKey(error.code)))
      navigate('/', { replace: true })
    } catch {
      setError(t('auth.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/signup" className="font-semibold text-primary">{t('auth.login.signupLink')}</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label={t('auth.fields.email')} type="email" autoComplete="email" inputMode="email"
          required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label={t('auth.fields.password')} type="password" autoComplete="current-password"
          required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link to="/forgot-password" className="self-end text-sm font-medium text-primary">{t('auth.login.forgot')}</Link>
        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" full loading={loading}>{t('auth.login.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
