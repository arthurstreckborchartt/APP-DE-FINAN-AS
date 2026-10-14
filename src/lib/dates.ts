const pad = (n: number) => String(n).padStart(2, '0')

function parts(iso: string): number[] {
  return iso.split('-').map(Number)
}

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isMonth(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7)
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = parts(month)
  const lastDay = new Date(y, m, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${pad(lastDay)}` }
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = parts(month)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function formatMonth(month: string, locale: string): string {
  const [y, m] = parts(month)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export function formatDay(dateISO: string, locale: string): string {
  const [y, m, d] = parts(dateISO)
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}

export function relativeDay(dateISO: string, today: string): 'today' | 'yesterday' | null {
  if (dateISO === today) return 'today'
  const [y, m, d] = parts(today)
  return dateISO === todayISO(new Date(y, m - 1, d - 1)) ? 'yesterday' : null
}

/** Data local (meia-noite) a partir de "YYYY-MM-DD", sem passar por UTC. */
export function dateFromISO(dateISO: string): Date {
  const [y, m, d] = parts(dateISO)
  return new Date(y, m - 1, d)
}

/** "YYYY-MM-DD" daqui a `days` dias (ou antes, se negativo). */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = parts(dateISO)
  return todayISO(new Date(y, m - 1, d + days))
}
