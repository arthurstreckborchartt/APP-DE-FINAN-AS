import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth, shiftMonth } from '../../lib/dates'

type Props = { month: string; locale: string; onChange: (month: string) => void }

export function MonthSwitcher({ month, locale, onChange }: Props) {
  const { t } = useTranslation()
  const btn = 'grid size-11 place-items-center rounded-full bg-bg text-fg transition hover:bg-surface-2 dark:bg-surface-2 dark:hover:bg-surface-3'
  return (
    <div className="flex items-center justify-between gap-2 rounded-full bg-surface p-1">
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('transactions.previousMonth')}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <span className="text-[15px] inline-block font-extrabold tracking-[-0.01em] first-letter:uppercase" aria-live="polite">{formatMonth(month, locale)}</span>
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, 1))} aria-label={t('transactions.nextMonth')}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
