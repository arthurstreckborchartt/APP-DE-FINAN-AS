import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { changeLocale } from '../../i18n'
import { applyTheme } from '../../lib/theme'
import { ProfileErrorState } from '../../app/ProfileErrorState'
import { useProfile, useUpdateProfile } from '../profile/api'
import { PreferencesFields, type PreferencesValue } from '../profile/PreferencesFields'

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile, isPending, isError, refetch } = useProfile()
  const update = useUpdateProfile()
  const [value, setValue] = useState<PreferencesValue | null>(null)

  if (isPending) return <FullScreenSpinner />
  if (isError || !profile) return <ProfileErrorState onRetry={() => void refetch()} />
  if (profile.onboarded_at) return <Navigate to="/" replace />

  const current: PreferencesValue = value ?? {
    name: profile.name, locale: profile.locale, currency: profile.currency, theme: profile.theme,
  }

  function onChange(next: PreferencesValue) {
    if (next.locale !== current.locale) void changeLocale(next.locale)
    if (next.theme !== current.theme) applyTheme(next.theme)
    setValue(next)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({ ...current, name: current.name.trim(), onboarded_at: new Date().toISOString() })
      navigate('/', { replace: true })
    } catch {
      // o erro é exibido via update.isError
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <Wallet className="size-10 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('onboarding.title')}</h1>
        <p className="mt-1 text-muted">{t('onboarding.subtitle')}</p>
        <div className="mt-6">
          <PreferencesFields value={current} onChange={onChange} nameRequired />
        </div>
        {update.isError && <p role="alert" className="mt-4 text-sm text-danger">{t('common.errorGeneric')}</p>}
        <Button type="submit" full className="mt-6" loading={update.isPending}>{t('onboarding.finish')}</Button>
      </form>
    </div>
  )
}
