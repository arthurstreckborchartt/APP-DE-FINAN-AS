import type { CurrencyCode } from '../../lib/money'

export const ACCOUNT_TYPES = ['cash', 'checking', 'savings', 'other'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  initial_balance: number
  archived: boolean
  created_at: string
  updated_at: string
}

export type AccountWithBalance = Account & { balance: number }
export type AccountInput = Pick<Account, 'name' | 'type' | 'currency' | 'initial_balance'>
export type AccountPatch = Partial<Pick<Account, 'name' | 'type' | 'initial_balance' | 'archived'>>
