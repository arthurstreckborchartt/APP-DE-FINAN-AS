import type { CurrencyCode } from '../../lib/money'
import type { Frequency } from '../../lib/recurrence'
import type { TransactionKind } from '../transactions/types'

export type Recurring = {
  id: string
  user_id: string
  kind: TransactionKind
  amount: number
  currency: CurrencyCode
  category_id: string
  description: string
  /** Conta de origem; nulo quando a recorrente é no cartão. */
  account_id: string | null
  /** Cartão de origem (só despesa); nulo quando é em conta. */
  card_id: string | null
  frequency: Frequency
  start_date: string
  end_date: string | null
  next_date: string
  paused: boolean
  created_at: string
  updated_at: string
}

/** Colunas graváveis no insert (`next_date` e `currency` são definidos pelo banco). */
export type RecurringInput = Pick<
  Recurring,
  'kind' | 'amount' | 'category_id' | 'description' | 'account_id' | 'card_id' | 'frequency' | 'start_date' | 'end_date'
>

/** Colunas graváveis no update. */
export type RecurringPatch = Partial<
  Pick<Recurring, 'amount' | 'category_id' | 'description' | 'account_id' | 'card_id' | 'frequency' | 'end_date' | 'paused'>
>
