export const CURRENCIES = ['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN'] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

export function formatMoney(cents: number, currency: string, locale: string, fractionDigits = 2): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100)
}

export function currencyName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code
}
