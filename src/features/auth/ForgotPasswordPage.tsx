import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './errors'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) return setError(t(authErrorKey(error.code)))
      setSent(true)
    } catch {
      setError(t('auth.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={<Link to="/login" className="font-semibold text-primary">{t('auth.forgot.backToLogin')}</Link>}
    >
      {sent ? (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-success">{t('auth.forgot.sent')}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField label={t('auth.fields.email')} type="email" autoComplete="email" inputMode="email"
            required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" full loading={loading}>{t('auth.forgot.submit')}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
