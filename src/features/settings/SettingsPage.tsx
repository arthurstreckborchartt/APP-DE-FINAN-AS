import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronRight, Landmark, LogOut, Repeat, Tags } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { useAuth } from '../auth/auth-context'
import { useProfile, useUpdateProfile } from '../profile/api'
import { PreferencesFields, type PreferencesValue } from '../profile/PreferencesFields'

export default function SettingsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuth()
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

  const initials = (profile.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') || '·').toUpperCase()

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('settings.title')}</h1>

      <div className="flex items-center gap-4 rounded-[24px] bg-surface p-5 shadow-sheet">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-xl font-extrabold text-primary-fg shadow-float">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-extrabold tracking-[-0.01em]">{profile.name || '—'}</span>
          <span className="block truncate text-sm font-medium text-muted">{user?.email}</span>
        </span>
      </div>

      <section>
        <h2 className="mb-2 px-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">{t('settings.money')}</h2>
        <nav aria-label={t('settings.money')} className="flex flex-col rounded-[24px] bg-surface p-2 shadow-sheet">
          {[
            { to: '/accounts', label: t('accounts.title'), icon: Landmark },
            { to: '/categories', label: t('categories.title'), icon: Tags },
            { to: '/recurring', label: t('recurring.title'), icon: Repeat },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex min-h-14 items-center gap-3.5 rounded-2xl px-3 py-2 transition hover:bg-surface-2">
              <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex-1 text-[15px] font-bold">{label}</span>
              <ChevronRight className="size-5 text-muted" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <section>
        <h2 className="mb-2 px-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">{t('settings.appearance')}</h2>
        <form onSubmit={onSubmit} className="rounded-[24px] bg-surface p-5 shadow-sheet sm:p-6">
          <PreferencesFields value={value} onChange={setDraft} />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" loading={update.isPending} disabled={!draft}>{t('common.save')}</Button>
            {update.isSuccess && !draft && <span role="status" className="text-sm font-semibold text-success">{t('common.saved')}</span>}
            {update.isError && <span role="alert" className="text-sm font-semibold text-danger">{t('common.errorGeneric')}</span>}
          </div>
        </form>
      </section>

      <Button variant="danger" className="self-start" onClick={() => void logout()}>
        <LogOut className="size-5" aria-hidden="true" /> {t('settings.logout')}
      </Button>
    </section>
  )
}
