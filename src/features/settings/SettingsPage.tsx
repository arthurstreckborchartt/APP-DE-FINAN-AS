import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronRight, Landmark, LogOut, Tags } from 'lucide-react'
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
    try {
      await update.mutateAsync({ ...value, name: value.name.trim() })
      setDraft(null)
    } catch {
      // o erro é exibido via update.isError; o rascunho é mantido
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      qc.clear()
    }
  }

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
      <nav aria-label={t('settings.title')} className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        {[
          { to: '/accounts', label: t('accounts.title'), icon: Landmark },
          { to: '/categories', label: t('categories.title'), icon: Tags },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-h-14 items-center gap-3 border-b border-line px-5 last:border-b-0 hover:bg-surface-2">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-5 text-muted" aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">{t('settings.profile')}</h2>
        <PreferencesFields value={value} onChange={setDraft} />
        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" loading={update.isPending} disabled={!draft}>{t('common.save')}</Button>
          {update.isSuccess && !draft && <span role="status" className="text-sm text-success">{t('common.saved')}</span>}
          {update.isError && <span role="alert" className="text-sm text-danger">{t('common.errorGeneric')}</span>}
        </div>
      </form>
      <Button variant="danger" className="mt-4" onClick={() => void logout()}>
        <LogOut className="size-5" aria-hidden="true" /> {t('settings.logout')}
      </Button>
    </section>
  )
}
