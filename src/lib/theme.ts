export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

export function applyTheme(pref: ThemePreference): void {
  const resolved = resolveTheme(pref, window.matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // armazenamento indisponível (modo privado): o tema só não persiste
  }
}

export function watchSystemTheme(pref: ThemePreference): () => void {
  if (pref !== 'system') return () => {}
  const mq = window.matchMedia(DARK_QUERY)
  const onChange = () => applyTheme('system')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
