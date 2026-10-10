/** Maior valor aceito para um lançamento: 999.999.999,99. */
export const MAX_AMOUNT_CENTS = 99_999_999_999

/** Teclado de valor: cada dígito entra pela direita (1 → 0,01; 12 → 0,12; 123 → 1,23). */
export function appendDigit(cents: number, digit: number): number {
  const next = cents * 10 + digit
  return next > MAX_AMOUNT_CENTS ? cents : next
}

export function removeDigit(cents: number): number {
  return Math.floor(cents / 10)
}

/**
 * Converte texto digitado ("1.234,56", "1,234.56", "-50") em centavos.
 * O último separador seguido de 1 ou 2 dígitos é o decimal; os demais são de milhar.
 */
export function parseAmount(text: string): number | null {
  const s = text.replace(/[\s\u00a0\u202f]/g, '')
  if (!s) return null
  const negative = s.startsWith('-')
  const body = negative ? s.slice(1) : s
  if (!body || !/^[0-9.,]+$/.test(body)) return null

  const lastSep = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'))
  let intPart = body
  let fracPart = ''
  if (lastSep !== -1 && body.length - lastSep - 1 <= 2) {
    intPart = body.slice(0, lastSep)
    fracPart = body.slice(lastSep + 1)
  }
  intPart = intPart.replace(/[.,]/g, '')
  if (!intPart && !fracPart) return null

  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null
  return negative ? -cents : cents
}

/** Valor com 2 casas e sem separador de milhar, para preencher campos de texto. */
export function formatAmountPlain(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100)
}
