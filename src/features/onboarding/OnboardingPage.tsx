import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { AccountForm } from '../accounts/AccountForm'
import { useAccounts, useCreateAccount } from '../accounts/api'
import type { AccountInput } from '../accounts/types'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { changeLocale } from '../../i18n'
import { applyTheme } from '../../lib/theme'
import { ProfileErrorState } from '../../app/ProfileErrorState'
import { useProfile, useUpdateProfile } from '../profile/api'
import { PreferencesFields, type PreferencesValue } from '../profile/PreferencesFields'
import { usePreferences } from '../profile/usePreferences'

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile, isPending, refetch } = useProfile()
  const update = useUpdateProfile()
  usePreferences(profile)
  const createAccount = useCreateAccount()
  const accountsQuery = useAccounts()
  const [value, setValue] = useState<PreferencesValue | null>(null)
  const [step, setStep] = useState<'preferences' | 'account'>('preferences')
  const [accountCreated, setAccountCreated] = useState(false)
  const [finishError, setFinishError] = useState(false)

  if (isPending) return <FullScreenSpinner />
  // Erro de refetch com perfil em cache não substitui a tela
  if (!profile) return <ProfileErrorState onRetry={() => void refetch()} />
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
      await update.mutateAsync({ ...current, name: current.name.trim() })
      setStep('account')
    } catch {
      // o erro é exibido via update.isError
    }
  }

  async function finish(account: AccountInput | null) {
    setFinishError(false)
    try {
      if (account && !accountCreated && !(accountsQuery.data?.length)) {
        await createAccount.mutateAsync(account)
        setAccountCreated(true)
      }
      await update.mutateAsync({ onboarded_at: new Date().toISOString() })
      navigate('/', { replace: true })
    } catch {
      setFinishError(true)
    }
  }

  const indicator = (
    <p className="text-sm font-medium text-primary">
      {step === 'preferences' ? `1/2 · ${t('onboarding.stepPreferences')}` : `2/2 · ${t('onboarding.stepAccount')}`}
    </p>
  )

  if (step === 'account') {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          {indicator}
          <Wallet className="mt-4 size-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('onboarding.accountTitle')}</h1>
          <p className="mt-1 text-muted">{t('onboarding.accountSubtitle')}</p>
          <div className="mt-6">
            <AccountForm
              initial={{ name: t('onboarding.defaultAccountName'), type: 'cash', currency: profile.currency, initial_balance: 0 }}
              currencyEditable
              submitLabel={t('onboarding.finish')}
              loading={createAccount.isPending || update.isPending}
              error={finishError ? t('common.errorGeneric') : null}
              onSubmit={(v) => void finish(v)}
            >
              <Button type="button" variant="ghost" full disabled={createAccount.isPending || update.isPending} onClick={() => void finish(null)}>{t('common.skip')}</Button>
            </AccountForm>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        {indicator}
        <Wallet className="mt-4 size-10 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('onboarding.title')}</h1>
        <p className="mt-1 text-muted">{t('onboarding.subtitle')}</p>
        <div className="mt-6">
          <PreferencesFields value={current} onChange={onChange} nameRequired />
        </div>
        {update.isError && <p role="alert" className="mt-4 text-sm text-danger">{t('common.errorGeneric')}</p>}
        <Button type="submit" full className="mt-6" loading={update.isPending}>{t('common.continue')}</Button>
      </form>
    </div>
  )
}
