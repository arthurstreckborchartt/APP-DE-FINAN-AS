import { Link, NavLink, Outlet, useMatch } from 'react-router'
import { useTranslation } from 'react-i18next'
import { initials } from '../lib/initials'
import { Plus, Settings } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { InstallPrompt } from '../components/InstallPrompt'
import { useProfile } from '../features/profile/api'
import { usePreferences } from '../features/profile/usePreferences'
import { useGenerateRecurringOnOpen } from '../features/recurring/api'
import { useRealtimeSync } from '../lib/realtime'
import { NAV_ITEMS } from './nav'

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-bold transition ${
    isActive ? 'bg-surface text-fg' : 'text-muted hover:bg-surface hover:text-fg'
  }`


export function AppShell() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  usePreferences(profile)
  useRealtimeSync()
  useGenerateRecurringOnOpen()
  // No formulário de lançamento a barra inferior sai do caminho do teclado de valor e do botão Salvar.
  const newMatch = useMatch('/new')
  const editMatch = useMatch('/transactions/:id/edit')
  const onForm = newMatch !== null || editMatch !== null

  const newItem = NAV_ITEMS.find((i) => i.primary)!
  const NewIcon = newItem.icon

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Menu lateral (PC/tablet largo) */}
      <div className="hidden border-r border-line bg-bg lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col gap-6 px-4 py-6">
        <Link to="/" className="flex min-h-11 items-center px-3" aria-label={t('nav.home')}>
          <BrandMark />
        </Link>
        <NavLink to="/new"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-bold text-ink-fg transition hover:bg-ink-hover active:scale-[0.98]">
          <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" /> {t('nav.newTransaction')}
        </NavLink>
        <nav aria-label={t('nav.mainMenu')} className="flex flex-col gap-1">
          {NAV_ITEMS.filter((i) => !i.primary).map(({ to, labelKey, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={sideLink}>
              {({ isActive }) => (
                <>
                  <Icon className={`size-5 ${isActive ? 'text-primary' : ''}`} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" /> {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/more"
          className={({ isActive }) =>
            `mt-auto flex items-center gap-3 rounded-[22px] p-2 pr-3 transition ${isActive ? 'bg-surface' : 'hover:bg-surface'}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-ink-fg">
            {initials(profile?.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{profile?.name || t('settings.title')}</span>
            <span className="block text-xs font-medium text-muted">{t('settings.title')}</span>
          </span>
          <Settings className="size-4 text-muted" aria-hidden="true" />
        </NavLink>
      </aside>
      </div>

      <div className="flex min-h-full min-w-0 flex-col">
        {/* Cabeçalho (celular) */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-bg px-5 pb-2
          pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:hidden">
          <Link to="/" aria-label={t('nav.home')} className="flex min-h-11 items-center"><BrandMark size={30} /></Link>
          <NavLink to="/more" aria-label={t('settings.title')}
            className="grid size-11 place-items-center rounded-full bg-surface text-sm font-extrabold text-fg transition hover:bg-surface-2">
            {initials(profile?.name)}
          </NavLink>
        </header>

        <main className={`mx-auto w-full max-w-6xl flex-1 px-5 pt-3 lg:px-10 lg:pb-12 lg:pt-10 ${onForm ? 'pb-6' : 'pb-36'}`}>
          <InstallPrompt />
          <Outlet />
        </main>

        {/* Botão flutuante de novo lançamento (celular) */}
        {!onForm && (
          <NavLink to={newItem.to} aria-label={t('nav.newTransaction')}
            className="fixed right-5 z-30 grid size-16 place-items-center rounded-full bg-ink text-ink-fg shadow-float transition
              hover:bg-ink-hover active:scale-95 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:hidden">
            <NewIcon className="size-7" strokeWidth={2.5} aria-hidden="true" />
          </NavLink>
        )}

        {/* Barra inferior (celular) */}
        <nav aria-label={t('nav.mainMenu')} hidden={onForm}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {NAV_ITEMS.filter((i) => !i.sidebarOnly && !i.primary).map(({ to, labelKey, icon: Icon }) => (
              <li key={to} className="flex justify-center">
                <NavLink to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                      isActive ? 'text-fg' : 'text-muted hover:text-fg'
                    }`}>
                  {({ isActive }) => (
                    <>
                      <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                      {t(labelKey)}
                      <span className={`size-1 rounded-full transition ${isActive ? 'bg-primary' : 'bg-transparent'}`} aria-hidden="true" />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
