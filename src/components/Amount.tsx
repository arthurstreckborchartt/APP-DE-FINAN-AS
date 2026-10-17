import type { ReactNode } from 'react'
import { formatMoney, formatMoneyParts } from '../lib/money'
import { useHideValues } from '../lib/privacy'

type Props = {
  cents: number
  currency: string
  locale: string
  /** "+"/"−" antes do valor, para lançamentos. */
  sign?: 'income' | 'expense'
  className?: string
  /** Sem centavos (arredondado): só para resumos estreitos que têm o valor exato em outro lugar. */
  whole?: boolean
  /** Símbolo da moeda pequeno (números de destaque): o número ganha a largura. */
  smallSymbol?: boolean
}

export function Amount({ cents, currency, locale, sign, className = '', whole = false, smallSymbol = false }: Props) {
  const hidden = useHideValues()
  const prefix = sign === 'income' ? '+' : sign === 'expense' ? '−' : ''
  const digits = whole ? 0 : 2
  let shown: ReactNode = formatMoney(cents, currency, locale, digits)
  if (smallSymbol) {
    const { sign: minus, before, number, after } = formatMoneyParts(cents, currency, locale, digits)
    shown = (
      <>
        {minus}
        {before && <span className="mr-[0.08em] align-[0.42em] text-[0.48em] font-bold tracking-normal">{before}</span>}
        {number}
        {after && <span className="ml-[0.1em] align-[0.42em] text-[0.48em] font-bold tracking-normal">{after}</span>}
      </>
    )
  }
  return (
    <span className={`num ${className}`}>
      {hidden ? (
        <span key="hidden" aria-hidden="true" className="reveal inline-block tracking-[0.18em]">••••</span>
      ) : (
        <span key="shown" className="reveal inline-block">{prefix}{shown}</span>
      )}
    </span>
  )
}
