import type { Transaction } from './types'

/** Movimento que tira dinheiro de uma conta sem ser despesa (pagamento de fatura). */
export type AccountOutflow = { date: string; amount: number; currency: string }

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function dayIndex(dateISO: string, month: string): number | null {
  if (dateISO.slice(0, 7) !== month) return null
  return Number(dateISO.slice(8, 10)) - 1
}

/** Despesas (conta e cartão) de uma moeda somadas por dia do mês. */
export function dailyExpenses(entries: Transaction[], month: string, currency: string): number[] {
  const days = new Array<number>(daysInMonth(month)).fill(0)
  for (const tx of entries) {
    if (tx.kind !== 'expense' || tx.currency !== currency) continue
    const i = dayIndex(tx.date, month)
    if (i !== null) days[i] += tx.amount
  }
  return days
}

export function cumulative(values: number[]): number[] {
  let sum = 0
  return values.map((v) => (sum += v))
}

/**
 * Saldo das contas de uma moeda ao fim de cada dia do mês, reconstruído de trás para frente
 * a partir do saldo atual: só lançamentos em conta e pagamentos de fatura mexem no saldo.
 */
export function dailyBalance(input: {
  currentBalance: number
  month: string
  currency: string
  entries: Transaction[]
  payments: AccountOutflow[]
}): number[] {
  const { currentBalance, month, currency, entries, payments } = input
  const moves = new Array<number>(daysInMonth(month)).fill(0)
  for (const tx of entries) {
    if (tx.account_id === null || tx.currency !== currency) continue
    const i = dayIndex(tx.date, month)
    if (i !== null) moves[i] += tx.kind === 'income' ? tx.amount : -tx.amount
  }
  for (const p of payments) {
    if (p.currency !== currency) continue
    const i = dayIndex(p.date, month)
    if (i !== null) moves[i] -= p.amount
  }
  const start = currentBalance - moves.reduce((a, b) => a + b, 0)
  return cumulative(moves).map((v) => start + v)
}
