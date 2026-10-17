import { createElement } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { categoryGlyph } from '../categories/icons'
import { Interpolate } from '../../components/Interpolate'
import { Ring } from '../../components/ui/Ring'
import { dateFromISO } from '../../lib/dates'
import { goalPlan } from '../../lib/goals'
import type { Goal } from './types'

/** Mês/ano curto do prazo ("dez. de 2026"), no idioma da interface. */
export function formatDeadline(deadline: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(dateFromISO(deadline))
}

type ProgressProps = { goal: Goal; locale: string; today: string }

/**
 * Progresso da meta: anel grande na cor dela (progressbar) com o percentual no centro, o valor guardado
 * em destaque, o alvo e o plano. O texto nunca fica sobre a cor.
 */
export function GoalProgress({ goal, locale, today, size = 104 }: ProgressProps & { size?: number }) {
  const { t } = useTranslation()
  const plan = goalPlan(goal.target_amount, goal.saved, today, goal.deadline)
  const amount = (cents: number, className = '') =>
    <Amount cents={cents} currency={goal.currency} locale={locale} className={className} />
  const pctText = t('goals.pct', { pct: plan.pct })

  let line
  if (plan.reached) {
    line = (
      <span className="inline-flex items-center gap-1.5 font-bold text-fg">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        {t('goals.reached')}
      </span>
    )
  } else if (plan.overdue) {
    line = (
      <span className="font-bold text-fg">
        <Interpolate i18nKey="goals.overdue" values={{ amount: amount(plan.remaining) }} />
      </span>
    )
  } else if (plan.perMonth !== null && goal.deadline) {
    line = (
      <span className="font-medium text-muted">
        <Interpolate i18nKey="goals.perMonth" values={{
          amount: amount(plan.perMonth, 'font-bold text-fg'),
          date: formatDeadline(goal.deadline, locale),
        }} />
      </span>
    )
  } else {
    line = (
      <span className="font-medium text-muted">
        {t('goals.noDeadline')} · <Interpolate i18nKey="goals.remaining" values={{ amount: amount(plan.remaining, 'font-bold text-fg') }} />
      </span>
    )
  }

  return (
    <span className="flex items-center gap-4">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-muted">
          <Interpolate i18nKey="goals.savedOf" values={{
            saved: amount(goal.saved, 'block pb-0.5 text-[clamp(1.75rem,8vw,2.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-fg'),
            target: amount(goal.target_amount, 'font-bold'),
          }} />
        </span>
        <span className="mt-2 block text-[13px] leading-snug">{line}</span>
      </span>
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.pct} aria-valuetext={pctText}
        aria-label={`${goal.name}: ${pctText}`} data-goal-ring={goal.color} className="shrink-0">
        <Ring value={plan.pct / 100} size={size} stroke={size >= 96 ? 10 : 8} color={goal.color}>
          <span className="num text-[17px] font-extrabold tracking-[-0.02em]">{pctText}</span>
        </Ring>
      </span>
    </span>
  )
}

type Props = ProgressProps & { onClick?: () => void }

/** Cartão da meta: ícone e nome em cima; valor guardado em destaque ao lado do anel na cor da meta. */
export function GoalCard({ goal, locale, today, onClick }: Props) {
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        {createElement(categoryGlyph(goal.icon), { className: 'size-5 shrink-0', style: { color: goal.color }, 'aria-hidden': true })}
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">{goal.name}</span>
      </span>
      <span className="mt-3 block">
        <GoalProgress goal={goal} locale={locale} today={today} />
      </span>
    </>
  )
  const cls = 'block w-full rounded-card bg-surface p-5 text-left sm:p-6'
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick}
      className={`${cls} transition hover:bg-surface-2 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}>
      {body}
    </button>
  )
}
