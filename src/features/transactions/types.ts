import type { CurrencyCode } from '../../lib/money'

export type TransactionKind = 'income' | 'expense'

export type Transaction = {
  id: string
  user_id: string
  kind: TransactionKind
  amount: number
  currency: CurrencyCode
  date: string
  category_id: string
  description: string
  /** Conta do lançamento; nulo quando a compra é no cartão. */
  account_id: string | null
  /** Cartão da compra; nulo quando o lançamento é em conta. */
  card_id: string | null
  installments_count: number
  /** Recorrente que gerou o lançamento; nulo nos lançamentos manuais. */
  recurring_id: string | null
  /** Grupo com que o lançamento é compartilhado; nulo quando é pessoal. */
  group_id: string | null
  created_at: string
  updated_at: string
}

/** Lançamento em conta (`card_id` nulo) ou compra no cartão (`account_id` nulo). */
export type TransactionInput = Pick<
  Transaction,
  'kind' | 'amount' | 'date' | 'category_id' | 'description' | 'account_id' | 'card_id' | 'installments_count' | 'group_id'
>

/**
 * Uma entrada do mês (competência): o lançamento em conta inteiro ou uma parcela da compra no cartão.
 * `id` é o do lançamento, `amount` é o valor da parcela e `date` é a data da entrada.
 */
export type MonthEntry = Transaction & {
  entry_id: string
  transaction_id: string
  installment_number: number
  total_amount: number
  purchase_date: string
}
