import { useEffect } from 'react'
import { changeLocale } from '../../i18n'
import { applyTheme, watchSystemTheme } from '../../lib/theme'
import type { Profile } from './types'

/** Mantém idioma e tema da interface iguais aos do perfil salvo. */
export function usePreferences(profile: Profile | undefined): void {
  const locale = profile?.locale
  const theme = profile?.theme

  useEffect(() => {
    if (locale) void changeLocale(locale)
  }, [locale])

  useEffect(() => {
    if (!theme) return
    applyTheme(theme)
    return watchSystemTheme(theme)
  }, [theme])
}
