import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth, shiftMonth } from '../../lib/dates'

type Props = { month: string; locale: string; onChange: (month: string) => void }

export function MonthSwitcher({ month, locale, onChange }: Props) {
  const { t } = useTranslation()
  const btn = 'grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg'
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-1 py-1">
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('transactions.previousMonth')}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <span className="font-semibold capitalize" aria-live="polite">{formatMonth(month, locale)}</span>
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, 1))} aria-label={t('transactions.nextMonth')}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
