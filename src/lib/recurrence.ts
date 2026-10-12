export type Frequency = 'weekly' | 'monthly' | 'yearly'

const pad = (n: number) => String(n).padStart(2, '0')
const parts = (iso: string) => iso.split('-').map(Number)
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()

export function nextOccurrence(dateISO: string, frequency: Frequency, anchorISO: string): string {
  const [y, m, d] = parts(dateISO)
  const [, am, ad] = parts(anchorISO)
  if (frequency === 'weekly') {
    const n = new Date(y, m - 1, d + 7)
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
  }
  let ty: number
  let tm: number
  if (frequency === 'monthly') {
    ty = m === 12 ? y + 1 : y
    tm = m === 12 ? 1 : m + 1
  } else {
    ty = y + 1
    tm = am
  }
  return `${ty}-${pad(tm)}-${pad(Math.min(ad, lastDayOf(ty, tm)))}`
}

export function upcomingOccurrences(
  r: { next_date: string; frequency: Frequency; start_date: string; end_date: string | null; paused: boolean },
  untilISO: string,
  limit = 12,
): string[] {
  if (r.paused) return []
  const out: string[] = []
  let d = r.next_date
  while (d <= untilISO && (!r.end_date || d <= r.end_date) && out.length < limit) {
    out.push(d)
    d = nextOccurrence(d, r.frequency, r.start_date)
  }
  return out
}
