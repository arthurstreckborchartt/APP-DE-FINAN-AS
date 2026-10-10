import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE, normalizeLocale, SUPPORTED_LOCALES, type Locale } from '../lib/locale'
import ptBR from './locales/pt-BR.json'
import ptPT from './locales/pt-PT.json'
import en from './locales/en.json'
import es from './locales/es.json'

export const LOCALE_STORAGE_KEY = 'locale'

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored) return normalizeLocale(stored)
  } catch {
    // sem localStorage: usa o idioma do navegador
  }
  return normalizeLocale(navigator.language)
}

const lng = initialLocale()

void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'pt-PT': { translation: ptPT },
    en: { translation: en },
    es: { translation: es },
  },
  lng,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: { escapeValue: false },
})
document.documentElement.lang = lng

export async function changeLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale)
  document.documentElement.lang = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // ignora: idioma só não persiste neste navegador
  }
}

export default i18n
