export type GoalPlan = {
  /** max(target - saved, 0) */
  remaining: number
  /** Inteiro 0..100 (arredondado para baixo; 100 se atingiu). */
  pct: number
  reached: boolean
  /** null sem prazo; ≥ 1 com prazo futuro ou no mês atual; 0 se o prazo passou. */
  monthsLeft: number | null
  /** ceil(remaining / monthsLeft); null sem prazo, se atingiu ou se o prazo passou. */
  perMonth: number | null
  /** Prazo < hoje e não atingiu. */
  overdue: boolean
}

/** Índice absoluto do mês de uma data 'YYYY-MM-DD' (sem passar por Date/UTC). */
function monthIndex(dateISO: string): number {
  const [y, m] = dateISO.split('-').map(Number)
  return y * 12 + (m - 1)
}

export function goalPlan(target: number, saved: number, todayISO: string, deadline: string | null): GoalPlan {
  const reached = saved >= target
  const remaining = Math.max(target - saved, 0)
  const pct = reached ? 100 : Math.min(99, Math.max(0, Math.floor((saved * 100) / target)))

  if (!deadline) return { remaining, pct, reached, monthsLeft: null, perMonth: null, overdue: false }

  // Datas 'YYYY-MM-DD' comparam corretamente como texto.
  const passed = deadline < todayISO
  const monthsLeft = passed ? 0 : monthIndex(deadline) - monthIndex(todayISO) + 1
  const perMonth = reached || passed ? null : Math.ceil(remaining / monthsLeft)
  return { remaining, pct, reached, monthsLeft, perMonth, overdue: passed && !reached }
}
