import { describe, expect, it } from 'vitest'
import type { InvoiceSummary } from '../cards/types'
import type { Recurring } from '../recurring/types'
import { buildUpcoming } from './upcoming'

const rec = (id: string, next: string, extra: Partial<Recurring> = {}) =>
  ({ id, frequency: 'monthly', start_date: next, end_date: next, next_date: next, paused: false, ...extra }) as Recurring
const inv = (id: string, due: string, total: number, extra: Partial<InvoiceSummary> = {}) =>
  ({ id, due_date: due, total, paid_at: null, ...extra }) as InvoiceSummary

describe('buildUpcoming', () => {
  const today = '2026-10-13'

  it('ordena recorrentes e faturas por data', () => {
    const out = buildUpcoming([rec('a', '2026-10-20')], [inv('f', '2026-10-15', 100)], today)
    expect(out.map((i) => i.type)).toEqual(['invoice', 'recurring'])
  })

  it('inclui hoje e exclui além de 30 dias', () => {
    const out = buildUpcoming([rec('a', '2026-10-13'), rec('b', '2026-11-13')], [], today)
    expect(out.map((i) => i.date)).toEqual(['2026-10-13'])
  })

  it('ignora pausadas, faturas pagas ou zeradas; marca vencidas', () => {
    const out = buildUpcoming(
      [rec('p', '2026-10-14', { paused: true })],
      [inv('z', '2026-10-14', 0), inv('p', '2026-10-14', 5, { paid_at: 'x' }), inv('o', '2026-10-01', 5)],
      today,
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ type: 'invoice', overdue: true })
  })

  it('limita a 6 itens', () => {
    const weekly = rec('w', '2026-10-13', { frequency: 'weekly', end_date: null })
    expect(buildUpcoming([weekly, rec('m', '2026-10-14')], [inv('f', '2026-10-15', 1)], today)).toHaveLength(6)
  })
})
