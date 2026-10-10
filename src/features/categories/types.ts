import type { TransactionKind } from '../transactions/types'

export type Category = {
  id: string
  user_id: string | null
  kind: TransactionKind
  name: string | null
  i18n_key: string | null
  icon: string
  color: string
  position: number
  archived: boolean
  created_at: string
  updated_at: string
}

export type CategoryInput = { kind: TransactionKind; name: string; icon: string; color: string }
export type CategoryPatch = Partial<Pick<Category, 'icon' | 'color' | 'archived'>> & { name?: string }
