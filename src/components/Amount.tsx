import { formatMoney } from '../lib/money'
import { useHideValues } from '../lib/privacy'

type Props = {
  cents: number
  currency: string
  locale: string
  /** "+"/"−" antes do valor, para lançamentos. */
  sign?: 'income' | 'expense'
  className?: string
}

export function Amount({ cents, currency, locale, sign, className = '' }: Props) {
  const hidden = useHideValues()
  const prefix = sign === 'income' ? '+' : sign === 'expense' ? '−' : ''
  return (
    <span className={`num ${className}`}>
      {hidden ? (
        <span aria-hidden="true" className="tracking-[0.18em]">••••</span>
      ) : (
        <>{prefix}{formatMoney(cents, currency, locale)}</>
      )}
    </span>
  )
}
