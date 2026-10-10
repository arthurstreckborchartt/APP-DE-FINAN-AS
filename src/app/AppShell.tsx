import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus, Settings, Wallet } from 'lucide-react'
import { APP_NAME } from '../config'
import { useProfile } from '../features/profile/api'
import { usePreferences } from '../features/profile/usePreferences'
import { InstallPrompt } from '../components/InstallPrompt'
import { NAV_ITEMS } from './nav'

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg'
  }`

export function AppShell() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  usePreferences(profile)

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Menu lateral (PC/tablet largo) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface p-4 lg:flex">
        <span className="flex items-center gap-2 px-3 py-2 text-lg font-bold text-primary">
          <Wallet className="size-6" aria-hidden="true" /> {APP_NAME}
        </span>
        <NavLink to="/new"
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg hover:opacity-90">
          <Plus className="size-5" aria-hidden="true" /> {t('nav.newTransaction')}
        </NavLink>
        <nav aria-label={t('nav.mainMenu')} className="mt-4 flex flex-col gap-1">
          {NAV_ITEMS.filter((i) => !i.primary).map(({ to, labelKey, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={sideLink}>
              <Icon className="size-5" aria-hidden="true" /> {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <NavLink to="/more" className={sideLink}>
            <Settings className="size-5" aria-hidden="true" /> {t('settings.title')}
          </NavLink>
        </div>
      </aside>

      <div className="flex min-h-full min-w-0 flex-col">
        {/* Cabeçalho (celular) */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/90 px-4 pb-3
          pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur lg:hidden">
          <span className="flex items-center gap-2 font-bold text-primary">
            <Wallet className="size-5" aria-hidden="true" /> {APP_NAME}
          </span>
          <NavLink to="/more" aria-label={t('nav.more')}
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            <Settings className="size-5" aria-hidden="true" />
          </NavLink>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10">
          <InstallPrompt />
          <Outlet />
        </main>

        {/* Barra inferior (celular) */}
        <nav aria-label={t('nav.mainMenu')}
          className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {NAV_ITEMS.map(({ to, labelKey, icon: Icon, primary }) => (
              <li key={to} className="flex justify-center">
                {primary ? (
                  <NavLink to={to} aria-label={t('nav.newTransaction')}
                    className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-lg ring-4 ring-bg">
                    <Icon className="size-7" aria-hidden="true" />
                  </NavLink>
                ) : (
                  <NavLink to={to} end={to === '/'}
                    className={({ isActive }) =>
                      `flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium ${
                        isActive ? 'text-primary' : 'text-muted'
                      }`}>
                    <Icon className="size-5" aria-hidden="true" />
                    {t(labelKey)}
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
