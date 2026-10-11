import { useTranslation } from 'react-i18next'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '../../lib/locale'
import type { ThemePreference } from '../../lib/theme'

export type PreferencesValue = { name: string; locale: Locale; currency: CurrencyCode; theme: ThemePreference }

type Props = { value: PreferencesValue; onChange: (v: PreferencesValue) => void; nameRequired?: boolean }

const THEMES: { value: ThemePreference; key: string }[] = [
  { value: 'system', key: 'preferences.themeSystem' },
  { value: 'light', key: 'preferences.themeLight' },
  { value: 'dark', key: 'preferences.themeDark' },
]

export function PreferencesFields({ value, onChange, nameRequired }: Props) {
  const { t } = useTranslation()
  const set = <K extends keyof PreferencesValue>(k: K, v: PreferencesValue[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t('preferences.name')} maxLength={80} autoComplete="name" required={nameRequired}
        value={value.name} onChange={(e) => set('name', e.target.value)} />
      <SelectField label={t('preferences.language')} value={value.locale}
        onChange={(e) => set('locale', e.target.value as Locale)}>
        {SUPPORTED_LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
      </SelectField>
      <SelectField label={t('preferences.currency')} value={value.currency}
        onChange={(e) => set('currency', e.target.value as CurrencyCode)}>
        {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {currencyName(c, value.locale)}</option>)}
      </SelectField>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-muted">{t('preferences.theme')}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
          {THEMES.map((th) => (
            <label key={th.value}
              className="flex h-11 cursor-pointer items-center justify-center rounded-full text-sm font-bold text-muted transition hover:text-fg
                has-checked:bg-surface has-checked:text-fg has-checked:shadow-sheet has-focus-visible:ring-2 has-focus-visible:ring-primary">
              <input type="radio" name="theme" className="sr-only" value={th.value}
                checked={value.theme === th.value} onChange={() => set('theme', th.value)} />
              {t(th.key)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
