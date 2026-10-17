import { useTranslation } from 'react-i18next'
import { CircleCheck } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Interpolate } from '../../components/Interpolate'
import { dateFromISO } from '../../lib/dates'
import { goalPlan } from '../../lib/goals'
import type { Goal } from './types'

/** Mês/ano curto do prazo ("dez. de 2026"), no idioma da interface. */
export function formatDeadline(deadline: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(dateFromISO(deadline))
}

type ProgressProps = { goal: Goal; locale: string; today: string }

/** Guardado de alvo, barra na cor da meta (o texto nunca fica sobre a cor), percentual e plano. */
export function GoalProgress({ goal, locale, today, track = 'bg-surface-2' }: ProgressProps & { track?: string }) {
  const { t } = useTranslation()
  const plan = goalPlan(goal.target_amount, goal.saved, today, goal.deadline)
  const amount = (cents: number, className = '') =>
    <Amount cents={cents} currency={goal.currency} locale={locale} className={className} />
  const pctText = t('goals.pct', { pct: plan.pct })

  let line
  if (plan.reached) {
    line = (
      <span className="inline-flex items-center gap-1.5 font-bold text-fg">
        <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
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
    <span className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-[13px] font-medium text-muted">
          <Interpolate i18nKey="goals.savedOf" values={{
            saved: amount(goal.saved, 'text-[17px] font-extrabold tracking-[-0.01em] text-fg'),
            target: amount(goal.target_amount, 'font-bold'),
          }} />
        </span>
        <span className="num shrink-0 text-[15px] font-extrabold">{pctText}</span>
      </span>
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.pct} aria-valuetext={pctText}
        aria-label={`${goal.name}: ${pctText}`} className={`mt-2 block h-2 overflow-hidden rounded-full ${track}`}>
        <span data-goal-bar className="block h-full rounded-full" style={{ width: `${plan.pct}%`, backgroundColor: goal.color }} />
      </span>
      <span className="mt-2 block text-[13px] leading-snug">{line}</span>
    </span>
  )
}

type Props = ProgressProps & { onClick?: () => void }

/** Ladrilho da meta: ícone na cor dela, nome e progresso. */
export function GoalCard({ goal, locale, today, onClick }: Props) {
  const body = (
    <>
      <span className="flex items-center gap-3">
        <CategoryIcon icon={goal.icon} color={goal.color} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">{goal.name}</span>
      </span>
      <span className="mt-4 block">
        <GoalProgress goal={goal} locale={locale} today={today} />
      </span>
    </>
  )
  const cls = 'block w-full rounded-[24px] bg-surface p-5 text-left shadow-sheet'
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick}
      className={`${cls} transition hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}>
      {body}
    </button>
  )
}
