import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { changeLocale } from '../i18n'
import { LOCALE_LABELS, normalizeLocale, SUPPORTED_LOCALES, type Locale } from '../lib/locale'

type Props = { value?: Locale; onChange?: (locale: Locale) => void }

/** Seletor compacto de idioma para telas sem login. Troca o idioma da interface na hora. */
export function LanguageSelect({ value, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const current = value ?? normalizeLocale(i18n.language)
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted focus-within:ring-2 focus-within:ring-primary hover:bg-surface-2">
      <Languages className="size-4" aria-hidden="true" />
      <span className="sr-only">{t('preferences.language')}</span>
      <select
        className="rounded-md bg-transparent text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary"
        value={current}
        onChange={(e) => {
          const next = normalizeLocale(e.target.value)
          void changeLocale(next)
          onChange?.(next)
        }}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} className="bg-surface text-fg">{LOCALE_LABELS[l]}</option>
        ))}
      </select>
    </label>
  )
}
