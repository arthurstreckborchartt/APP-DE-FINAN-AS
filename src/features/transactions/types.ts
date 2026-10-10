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
  account_id: string
  created_at: string
  updated_at: string
}

export type TransactionInput = Pick<Transaction, 'kind' | 'amount' | 'date' | 'category_id' | 'description' | 'account_id'>
