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

/**
 * O valor formatado em pedaços: sinal, símbolo da moeda (antes ou depois, conforme o idioma) e
 * número, sem os espaços colados ao símbolo.
 */
export function formatMoneyParts(cents: number, currency: string, locale: string, fractionDigits = 2): {
  sign: string; before: string; number: string; after: string
} {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  }).formatToParts(cents / 100)
  const at = parts.findIndex((p) => p.type === 'currency')
  const firstNum = parts.findIndex((p) => p.type === 'integer' || p.type === 'nan' || p.type === 'infinity')
  const symbol = at >= 0 ? parts[at].value : ''
  const symbolFirst = at >= 0 && at < firstNum
  const number = parts
    .filter((p) => p.type !== 'currency' && p.type !== 'minusSign' && p.type !== 'plusSign' && !(p.type === 'literal' && /^\s+$/.test(p.value)))
    .map((p) => p.value).join('')
  return {
    sign: parts.filter((p) => p.type === 'minusSign' || p.type === 'plusSign').map((p) => p.value).join(''),
    before: symbolFirst ? symbol : '',
    number,
    after: symbolFirst ? '' : symbol,
  }
}

export function currencyName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code
}
