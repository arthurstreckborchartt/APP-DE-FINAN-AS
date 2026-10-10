import type { CurrencyCode } from '../../lib/money'
import type { Locale } from '../../lib/locale'
import type { ThemePreference } from '../../lib/theme'

export type Profile = {
  id: string
  name: string
  locale: Locale
  currency: CurrencyCode
  theme: ThemePreference
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type ProfilePatch = Partial<Pick<Profile, 'name' | 'locale' | 'currency' | 'theme' | 'onboarded_at'>>
