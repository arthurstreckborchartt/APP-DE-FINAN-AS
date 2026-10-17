import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChartColumn, ChevronRight, Landmark, LogOut, PiggyBank, Repeat, Tags, Target } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { initials } from '../../lib/initials'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { IconTile, PageHeader, SectionHeader } from '../../components/ui/Card'
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


  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t('settings.title')} />

      <div className="flex items-center gap-4 rounded-card bg-surface p-5">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-ink text-xl font-extrabold text-ink-fg" aria-hidden="true">
          {initials(profile.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-extrabold tracking-[-0.01em]">{profile.name || '—'}</span>
          <span className="block truncate text-sm font-medium text-muted">{user?.email}</span>
        </span>
      </div>

      <section>
        <SectionHeader title={t('settings.money')} />
        <nav aria-label={t('settings.money')} className="overflow-hidden rounded-card bg-surface">
          <ul className="divide-y divide-bg">
          {[
            { to: '/accounts', label: t('accounts.title'), icon: Landmark },
            { to: '/categories', label: t('categories.title'), icon: Tags },
            { to: '/recurring', label: t('recurring.title'), icon: Repeat },
            { to: '/budgets', label: t('budgets.title'), icon: Target },
            { to: '/goals', label: t('goals.title'), icon: PiggyBank },
            { to: '/reports', label: t('reports.title'), icon: ChartColumn },
          ].map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex min-h-15 items-center gap-3.5 px-4 py-2.5 transition hover:bg-surface-2
                focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                <IconTile icon={Icon} size="sm" />
                <span className="flex-1 text-[15px] font-bold">{label}</span>
                <ChevronRight className="size-5 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
          </ul>
        </nav>
      </section>

      <section>
        <SectionHeader title={t('settings.appearance')} />
        <form onSubmit={onSubmit} className="rounded-card bg-surface p-5 sm:p-6">
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
