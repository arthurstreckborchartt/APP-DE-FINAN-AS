import { shiftMonth } from './dates'

const pad = (n: number) => String(n).padStart(2, '0')

export function invoiceMonthFor(dateISO: string, closingDay: number): string {
  const month = dateISO.slice(0, 7)
  const day = Number(dateISO.slice(8, 10))
  return day < closingDay ? month : shiftMonth(month, 1)
}

export function closingDateOf(month: string, closingDay: number): string {
  return `${month}-${pad(closingDay)}`
}

export function dueDateOf(month: string, closingDay: number, dueDay: number): string {
  const dueMonth = dueDay > closingDay ? month : shiftMonth(month, 1)
  return `${dueMonth}-${pad(dueDay)}`
}

export function splitInstallments(amount: number, n: number): number[] {
  const base = Math.floor(amount / n)
  const rest = amount - base * n
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? rest : 0))
}

export type ScheduleItem = { number: number; amount: number; invoiceMonth: string; competenceMonth: string }

export function installmentSchedule(dateISO: string, amount: number, n: number, closingDay: number): ScheduleItem[] {
  const first = invoiceMonthFor(dateISO, closingDay)
  const purchaseMonth = dateISO.slice(0, 7)
  return splitInstallments(amount, n).map((value, i) => ({
    number: i + 1,
    amount: value,
    invoiceMonth: shiftMonth(first, i),
    competenceMonth: shiftMonth(purchaseMonth, i),
  }))
}

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue'

export function invoiceStatus(inv: { paid_at: string | null; closing_date: string; due_date: string }, today: string): InvoiceStatus {
  if (inv.paid_at) return 'paid'
  if (today < inv.closing_date) return 'open'
  if (today > inv.due_date) return 'overdue'
  return 'closed'
}
