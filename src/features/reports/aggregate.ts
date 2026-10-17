import { shiftMonth } from '../../lib/dates'

export type ReportEntry = {
  kind: 'income' | 'expense'
  amount: number
  currency: string
  /** 'YYYY-MM' */
  month: string
  category_id: string
  account_id?: string | null
  card_id?: string | null
  user_id?: string
}

export type ReportPreset = 'last3' | 'last6' | 'last12' | 'thisYear'

/** Meses de `fromMonth` a `toMonth`, inclusivo ('YYYY-MM'). Vazio se invertido. */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const out: string[] = []
  for (let m = fromMonth; m <= toMonth; m = shiftMonth(m, 1)) out.push(m)
  return out
}

/** Intervalo do período terminando no mês atual (ou o ano atual até o mês atual). */
export function periodMonths(preset: ReportPreset, currentMonth: string): { from: string; to: string } {
  switch (preset) {
    case 'last3':
      return { from: shiftMonth(currentMonth, -2), to: currentMonth }
    case 'last6':
      return { from: shiftMonth(currentMonth, -5), to: currentMonth }
    case 'last12':
      return { from: shiftMonth(currentMonth, -11), to: currentMonth }
    case 'thisYear':
      return { from: `${currentMonth.slice(0, 4)}-01`, to: currentMonth }
  }
}

export function monthlyTotals(
  entries: ReportEntry[],
  months: string[],
  currency: string,
): { month: string; income: number; expense: number }[] {
  const byMonth = new Map(months.map((month) => [month, { month, income: 0, expense: 0 }]))
  for (const e of entries) {
    if (e.currency !== currency) continue
    const row = byMonth.get(e.month)
    if (row) row[e.kind] += e.amount
  }
  return [...byMonth.values()]
}

/** Só despesas; `share` inteiro (%); ordenado por valor desc. */
export function categoryTotals(
  entries: ReportEntry[],
  currency: string,
): { category_id: string; amount: number; share: number }[] {
  const sums = new Map<string, number>()
  let total = 0
  for (const e of entries) {
    if (e.kind !== 'expense' || e.currency !== currency) continue
    sums.set(e.category_id, (sums.get(e.category_id) ?? 0) + e.amount)
    total += e.amount
  }
  if (total <= 0) return []
  return [...sums]
    .map(([category_id, amount]) => ({ category_id, amount, share: Math.round((amount * 100) / total) }))
    .sort((a, b) => b.amount - a.amount)
}

/** Só despesas, por membro e mês; ordenado por total desc. */
export function memberMonthly(
  entries: ReportEntry[],
  months: string[],
  currency: string,
): { user_id: string; values: number[]; total: number }[] {
  const index = new Map(months.map((m, i) => [m, i]))
  const rows = new Map<string, { user_id: string; values: number[]; total: number }>()
  for (const e of entries) {
    if (e.kind !== 'expense' || e.currency !== currency || !e.user_id) continue
    const i = index.get(e.month)
    if (i === undefined) continue
    let row = rows.get(e.user_id)
    if (!row) {
      row = { user_id: e.user_id, values: months.map(() => 0), total: 0 }
      rows.set(e.user_id, row)
    }
    row.values[i] += e.amount
    row.total += e.amount
  }
  return [...rows.values()].sort((a, b) => b.total - a.total)
}

/** Moedas presentes, ordenadas por volume de despesas desc. */
export function currenciesOf(entries: ReportEntry[]): string[] {
  const volume = new Map<string, number>()
  for (const e of entries) {
    volume.set(e.currency, (volume.get(e.currency) ?? 0) + (e.kind === 'expense' ? e.amount : 0))
  }
  return [...volume].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
}
