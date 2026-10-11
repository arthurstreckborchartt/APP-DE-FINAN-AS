import { Link, NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus, Settings } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { InstallPrompt } from '../components/InstallPrompt'
import { useProfile } from '../features/profile/api'
import { usePreferences } from '../features/profile/usePreferences'
import { NAV_ITEMS } from './nav'

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex h-12 items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold transition ${
    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg'
  }`

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·'
}

export function AppShell() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  usePreferences(profile)

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Menu lateral (PC/tablet largo) */}
      <div className="hidden border-r border-line bg-surface lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col gap-6 px-4 py-6">
        <Link to="/" className="px-3" aria-label={t('nav.home')}>
          <BrandMark />
        </Link>
        <NavLink to="/new"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-bold text-primary-fg shadow-float transition hover:bg-primary-strong">
          <Plus className="size-5" aria-hidden="true" /> {t('nav.newTransaction')}
        </NavLink>
        <nav aria-label={t('nav.mainMenu')} className="flex flex-col gap-1">
          {NAV_ITEMS.filter((i) => !i.primary).map(({ to, labelKey, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={sideLink}>
              <Icon className="size-5" aria-hidden="true" /> {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/more"
          className={({ isActive }) =>
            `mt-auto flex items-center gap-3 rounded-2xl p-2 pr-3 transition ${isActive ? 'bg-primary-soft' : 'hover:bg-surface-2'}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
            {initials(profile?.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{profile?.name || t('settings.title')}</span>
            <span className="block text-xs text-muted">{t('settings.title')}</span>
          </span>
          <Settings className="size-4 text-muted" aria-hidden="true" />
        </NavLink>
      </aside>
      </div>

      <div className="flex min-h-full min-w-0 flex-col">
        {/* Cabeçalho (celular) */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-bg/90 px-4 pb-2
          pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md lg:hidden">
          <Link to="/" aria-label={t('nav.home')}><BrandMark size={28} /></Link>
          <NavLink to="/more" aria-label={t('settings.title')}
            className="grid size-11 place-items-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
            {initials(profile?.name)}
          </NavLink>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-3 lg:px-10 lg:pb-12 lg:pt-10">
          <InstallPrompt />
          <Outlet />
        </main>

        {/* Barra inferior (celular) */}
        <nav aria-label={t('nav.mainMenu')}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(12_18_34/0.18)] lg:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {NAV_ITEMS.map(({ to, labelKey, icon: Icon, primary }) => (
              <li key={to} className="flex justify-center">
                {primary ? (
                  <NavLink to={to} aria-label={t('nav.newTransaction')}
                    className="-mt-6 grid size-[60px] place-items-center rounded-full bg-primary text-primary-fg shadow-float ring-[6px] ring-bg transition active:scale-95">
                    <Icon className="size-7" strokeWidth={2.5} aria-hidden="true" />
                  </NavLink>
                ) : (
                  <NavLink to={to} end={to === '/'}
                    className={({ isActive }) =>
                      `flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                        isActive ? 'text-primary' : 'text-muted'
                      }`}>
                    {({ isActive }) => (
                      <>
                        <span className={`grid h-7 w-12 place-items-center rounded-full transition ${isActive ? 'bg-primary-soft' : ''}`}>
                          <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                        </span>
                        {t(labelKey)}
                      </>
                    )}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
