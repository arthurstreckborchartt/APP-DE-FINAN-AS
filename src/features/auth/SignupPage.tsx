import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MailCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normalizeLocale } from '../../lib/locale'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './errors'

export default function SignupPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError(t('auth.errors.weakPassword'))
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), locale: normalizeLocale(i18n.language) },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      if (error) return setError(t(authErrorKey(error.code)))
      if (data.session) return navigate('/', { replace: true })
      setSentTo(email.trim())
    } catch {
      setError(t('auth.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.signup.checkEmailTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="size-12 text-primary" aria-hidden="true" />
          <p className="text-muted">{t('auth.signup.checkEmailBody', { email: sentTo })}</p>
          <Link to="/login" className="font-semibold text-primary">{t('auth.forgot.backToLogin')}</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary">{t('auth.signup.loginLink')}</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label={t('auth.fields.name')} autoComplete="name" maxLength={80}
          required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label={t('auth.fields.email')} type="email" autoComplete="email" inputMode="email"
          required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label={t('auth.fields.password')} type="password" autoComplete="new-password" minLength={8}
          required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" full loading={loading}>{t('auth.signup.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
