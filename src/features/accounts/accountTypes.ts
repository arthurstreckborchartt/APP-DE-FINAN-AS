import { CircleDollarSign, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import type { AccountType } from './types'

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  cash: Wallet,
  checking: Landmark,
  savings: PiggyBank,
  other: CircleDollarSign,
}
