export const SUPPORTED_LOCALES = ['pt-BR', 'pt-PT', 'en', 'es'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt-BR'

export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  en: 'English',
  es: 'Español',
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v)
}

export function normalizeLocale(tag: string | null | undefined): Locale {
  if (!tag) return DEFAULT_LOCALE
  if (isLocale(tag)) return tag
  const [lang, region] = tag.split('-')
  if (lang === 'pt') return !region || region.toUpperCase() === 'BR' ? 'pt-BR' : 'pt-PT'
  if (lang === 'es') return 'es'
  return 'en'
}
