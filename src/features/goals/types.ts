import type { CurrencyCode } from '../../lib/money'

/** Linha da view `goal_progress`: a meta com o guardado (soma dos aportes). */
export type Goal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  currency: CurrencyCode
  deadline: string | null
  icon: string
  color: string
  archived: boolean
  created_at: string
  updated_at: string
  saved: number
  contributions: number
  last_contribution: string | null
}

/** Colunas graváveis no insert. */
export type GoalInput = Pick<Goal, 'name' | 'target_amount' | 'currency' | 'deadline' | 'icon' | 'color'>

/** Colunas graváveis no update (a moeda não muda). */
export type GoalPatch = Partial<Pick<Goal, 'name' | 'target_amount' | 'deadline' | 'icon' | 'color' | 'archived'>>

/** Aporte manual; negativo é retirada. Não mexe no saldo das contas. */
export type GoalContribution = {
  id: string
  user_id: string
  goal_id: string
  amount: number
  date: string
  note: string
  created_at: string
}

export type GoalContributionInput = Pick<GoalContribution, 'goal_id' | 'amount' | 'date' | 'note'>
