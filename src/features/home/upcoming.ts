import { addDaysISO } from '../../lib/dates'
import { upcomingOccurrences } from '../../lib/recurrence'
import type { InvoiceSummary } from '../cards/types'
import type { Recurring } from '../recurring/types'

export const UPCOMING_DAYS = 30
export const UPCOMING_LIMIT = 6

export type UpcomingItem =
  | { type: 'recurring'; key: string; date: string; recurring: Recurring }
  | { type: 'invoice'; key: string; date: string; invoice: InvoiceSummary; overdue: boolean }

/** Próximos vencimentos: ocorrências de recorrentes ativas e faturas não pagas com valor. */
export function buildUpcoming(
  recurring: Recurring[],
  invoices: InvoiceSummary[],
  today: string,
  limit = UPCOMING_LIMIT,
): UpcomingItem[] {
  const until = addDaysISO(today, UPCOMING_DAYS)
  const items: UpcomingItem[] = []
  for (const r of recurring) {
    for (const date of upcomingOccurrences(r, until, limit)) {
      items.push({ type: 'recurring', key: `r-${r.id}-${date}`, date, recurring: r })
    }
  }
  for (const invoice of invoices) {
    if (invoice.paid_at || invoice.total <= 0 || invoice.due_date > until) continue
    items.push({ type: 'invoice', key: `i-${invoice.id}`, date: invoice.due_date, invoice, overdue: invoice.due_date < today })
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)).slice(0, limit)
}

