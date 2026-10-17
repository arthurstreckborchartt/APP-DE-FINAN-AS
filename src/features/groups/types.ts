import type { CurrencyCode } from '../../lib/money'
import type { TransactionKind } from '../transactions/types'

export type GroupRole = 'admin' | 'member'

export type Group = {
  id: string
  name: string
  currency: CurrencyCode
  icon: string
  role: GroupRole
  members: number
  created_at: string
}

export type GroupMember = { user_id: string; name: string; role: GroupRole; joined_at: string; left_at: string | null }

/** Entrada do mês no grupo (competência). Nunca traz conta ou cartão: só `is_card`. */
export type GroupEntry = {
  entry_id: string
  transaction_id: string
  user_id: string
  kind: TransactionKind
  amount: number
  currency: CurrencyCode
  date: string
  category_id: string
  category_name: string | null
  category_key: string | null
  category_icon: string
  category_color: string
  description: string
  is_card: boolean
  installment_number: number
  installments_count: number
  created_at: string
}

/** Entrada do grupo num intervalo de meses; `month` no formato 'YYYY-MM'. */
export type GroupPeriodEntry = GroupEntry & { month: string }

export type GroupInvite = {
  id: string
  group_id: string
  token: string
  expires_at: string
  revoked_at: string | null
  created_at: string
}

export type InvitePreview = {
  group_id: string
  name: string
  icon: string
  currency: CurrencyCode
  members: number
  expires_at: string
  /** `removed`: removido pelo admin e o link é anterior à remoção. */
  status: 'valid' | 'expired' | 'member' | 'removed'
}

export type GroupInput = { name: string; currency: CurrencyCode; icon: string }
