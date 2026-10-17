import type { CurrencyCode } from '../../lib/money'

/** Limite mensal de uma categoria de despesa. Pessoal (`user_id`) ou do grupo (`group_id`). */
export type Budget = {
  id: string
  user_id: string | null
  group_id: string | null
  category_id: string
  amount: number
  currency: CurrencyCode
  created_at: string
  updated_at: string
}

/** No grupo, o banco força a moeda do grupo. */
export type BudgetInput = {
  category_id: string
  amount: number
  currency: CurrencyCode
  group_id: string | null
}
