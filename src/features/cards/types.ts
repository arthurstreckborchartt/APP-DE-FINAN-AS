import type { CurrencyCode } from '../../lib/money'

export type Card = {
  id: string
  user_id: string
  name: string
  limit_amount: number
  closing_day: number
  due_day: number
  currency: CurrencyCode
  color: string
  archived: boolean
  created_at: string
  updated_at: string
}

export type CardWithLimit = Card & { used: number; available: number }
export type CardInput = Pick<Card, 'name' | 'limit_amount' | 'closing_day' | 'due_day' | 'currency' | 'color'>
export type CardPatch = Partial<Pick<Card, 'name' | 'limit_amount' | 'closing_day' | 'due_day' | 'color' | 'archived'>>

export type InvoiceSummary = {
  id: string
  card_id: string
  reference_month: string
  closing_date: string
  due_date: string
  paid_at: string | null
  payment_account_id: string | null
  payment_amount: number | null
  currency: CurrencyCode
  total: number
  items: number
}

export type InvoiceItem = {
  id: string
  number: number
  amount: number
  transaction: {
    id: string
    description: string
    category_id: string
    installments_count: number
    date: string
    amount: number
  }
}
