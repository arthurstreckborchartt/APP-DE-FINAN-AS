import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { useProfile, useUpdateProfile } from '../profile/api'
import { PreferencesFields, type PreferencesValue } from '../profile/PreferencesFields'

export default function SettingsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const [draft, setDraft] = useState<PreferencesValue | null>(null)

  if (!profile) return <FullScreenSpinner />

  const value: PreferencesValue = draft ?? {
    name: profile.name, locale: profile.locale, currency: profile.currency, theme: profile.theme,
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await update.mutateAsync({ ...value, name: value.name.trim() })
    setDraft(null)
  }

  async function logout() {
    await supabase.auth.signOut()
    qc.clear()
  }

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">{t('settings.profile')}</h2>
        <PreferencesFields value={value} onChange={setDraft} />
        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" loading={update.isPending} disabled={!draft}>{t('common.save')}</Button>
          {update.isSuccess && !draft && <span role="status" className="text-sm text-success">{t('common.saved')}</span>}
          {update.isError && <span role="alert" className="text-sm text-danger">{t('common.errorGeneric')}</span>}
        </div>
      </form>
      <Button variant="danger" className="mt-4" onClick={logout}>
        <LogOut className="size-5" aria-hidden="true" /> {t('settings.logout')}
      </Button>
    </section>
  )
}
