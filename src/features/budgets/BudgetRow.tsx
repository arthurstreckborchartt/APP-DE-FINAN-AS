import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Interpolate } from '../../components/Interpolate'
import { budgetLevel, budgetPct, type BudgetLevel } from '../../lib/budget'
import type { Category } from '../categories/types'
import { categoryLabel } from '../categories/label'

const LEVEL_BAR: Record<BudgetLevel, string> = { ok: 'bg-primary', warn: 'bg-warning', over: 'bg-danger' }

/** Barra de progresso do orçamento: largura limitada a 100%; passou → cheia em `danger`. */
export function BudgetBar({ spent, limit, className = '' }: { spent: number; limit: number; className?: string }) {
  const level = budgetLevel(spent, limit)
  const width = limit > 0 ? Math.min(100, Math.max(0, (spent / limit) * 100)) : 0
  return (
    <span className={`block h-2 overflow-hidden rounded-full bg-surface-2 ${className}`} aria-hidden="true">
      <span data-level={level} className={`block h-full rounded-full ${LEVEL_BAR[level]}`} style={{ width: `${width}%` }} />
    </span>
  )
}

/** Pílula de aviso (texto + cor, nunca só cor); nada em `ok`. */
export function BudgetPill({ level }: { level: BudgetLevel }) {
  const { t } = useTranslation()
  if (level === 'ok') return null
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-bold text-fg ${
      level === 'over' ? 'bg-danger/12' : 'bg-warning/15'}`}>
      <span className={`size-1.5 rounded-full ${LEVEL_BAR[level]}`} aria-hidden="true" />
      {t(level === 'over' ? 'budgets.overLabel' : 'budgets.warn')}
    </span>
  )
}

type Props = {
  category?: Category
  spent: number
  limit: number
  currency: string
  locale: string
  /** Versão menor para o Início. */
  compact?: boolean
  /** Sem `onClick`, a linha é só leitura. */
  onClick?: () => void
}

export function BudgetRow({ category, spent, limit, currency, locale, compact = false, onClick }: Props) {
  const { t } = useTranslation()
  const level = budgetLevel(spent, limit)
  const pct = budgetPct(spent, limit)
  const over = spent > limit
  const body = (
    <span className="flex items-center gap-3.5">
      {category && <CategoryIcon icon={category.icon} color={category.color} size={compact ? 'sm' : 'md'} />}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-bold tracking-[-0.01em]">{category ? categoryLabel(category, t) : '—'}</span>
          <BudgetPill level={level} />
          <span className={`num ml-auto shrink-0 pl-1 text-[15px] font-extrabold ${over ? 'text-danger' : ''}`}>{t('budgets.pct', { pct })}</span>
        </span>
        <BudgetBar spent={spent} limit={limit} className="mt-2" />
        <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
          <span className="font-medium text-muted">
            <Interpolate i18nKey="budgets.spentOf" values={{
              spent: <Amount cents={spent} currency={currency} locale={locale} className="font-bold text-fg" />,
              limit: <Amount cents={limit} currency={currency} locale={locale} />,
            }} />
          </span>
          <span className={over ? 'font-bold text-danger' : 'font-medium text-muted'}>
            <Interpolate i18nKey={over ? 'budgets.over' : 'budgets.left'} values={{
              amount: <Amount cents={Math.abs(limit - spent)} currency={currency} locale={locale} />,
            }} />
          </span>
        </span>
      </span>
    </span>
  )
  const cls = `-mx-3 block w-full rounded-2xl px-3 ${compact ? 'py-2' : 'py-3'} text-left`
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick}
      className={`${cls} transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary`}>
      {body}
    </button>
  )
}
