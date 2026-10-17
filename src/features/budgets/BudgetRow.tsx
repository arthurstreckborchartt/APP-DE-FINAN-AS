import { createElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { Interpolate } from '../../components/Interpolate'
import { Ring } from '../../components/ui/Ring'
import { budgetLevel, budgetPct, type BudgetLevel } from '../../lib/budget'
import type { Category } from '../categories/types'
import { categoryGlyph } from '../categories/icons'
import { categoryLabel } from '../categories/label'

const LEVEL_BAR: Record<BudgetLevel, string> = { ok: 'bg-primary', warn: 'bg-warning', over: 'bg-danger' }
const LEVEL_RING: Record<Exclude<BudgetLevel, 'ok'>, string> = { warn: 'var(--warning)', over: 'var(--danger)' }

/**
 * Anel do orçamento de uma categoria (progressbar): na cor da categoria até 80%, depois aviso e,
 * passou do limite, cheio em `danger`. O glifo da categoria fica no centro.
 */
export function BudgetRing({ spent, limit, label, icon, color, size = 52 }: {
  spent: number; limit: number; label: string; icon?: string; color?: string; size?: number
}) {
  const { t } = useTranslation()
  const level = budgetLevel(spent, limit)
  const pct = budgetPct(spent, limit)
  const stroke = level === 'ok' ? color ?? 'var(--primary)' : LEVEL_RING[level]
  return (
    <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)}
      aria-valuetext={t('budgets.pct', { pct })} aria-label={`${label}: ${t('budgets.pct', { pct })}`}
      data-level={level} data-ring-color={stroke} className="shrink-0">
      <Ring value={limit > 0 ? spent / limit : 0} size={size} stroke={size >= 52 ? 6 : 5} color={stroke}>
        {icon && createElement(categoryGlyph(icon), {
          className: size >= 52 ? 'size-5' : 'size-4', style: { color: color ?? 'var(--primary)' }, 'aria-hidden': true,
        })}
      </Ring>
    </span>
  )
}

/** Barra de progresso do orçamento: largura limitada a 100%; passou → cheia em `danger`. */
export function BudgetBar({ spent, limit, label, className = '' }: { spent: number; limit: number; label: string; className?: string }) {
  const { t } = useTranslation()
  const level = budgetLevel(spent, limit)
  const pct = budgetPct(spent, limit)
  const width = limit > 0 ? Math.min(100, Math.max(0, (spent / limit) * 100)) : 0
  return (
    <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)}
      aria-valuetext={t('budgets.pct', { pct })} aria-label={`${label}: ${t('budgets.pct', { pct })}`}
      className={`block h-2 overflow-hidden rounded-full bg-surface-2 ${className}`}>
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
  /** Linha própria (dentro de um RowItem), em vez de recuada dentro de um cartão. */
  flush?: boolean
}

export function BudgetRow({ category, spent, limit, currency, locale, compact = false, onClick, flush = false }: Props) {
  const { t } = useTranslation()
  const level = budgetLevel(spent, limit)
  const pct = budgetPct(spent, limit)
  const over = spent > limit
  const name = category ? categoryLabel(category, t) : '—'
  const body = (
    <span className="flex items-center gap-3.5">
      <BudgetRing spent={spent} limit={limit} label={name} icon={category?.icon} color={category?.color} size={compact ? 44 : 52} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 max-w-full truncate text-[15px] font-bold tracking-[-0.01em]">{name}</span>
            <BudgetPill level={level} />
          </span>
          <span className={`num shrink-0 pl-1 text-[17px] font-extrabold tracking-[-0.02em] ${over ? 'text-danger' : ''}`}>{t('budgets.pct', { pct })}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
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
  const cls = flush
    ? 'block w-full px-3.5 py-3 text-left'
    : `-mx-2 block w-[calc(100%+1rem)] rounded-[18px] px-2 ${compact ? 'py-2' : 'py-2.5'} text-left`
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick}
      className={`${cls} transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary`}>
      {body}
    </button>
  )
}
