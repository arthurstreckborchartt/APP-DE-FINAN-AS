import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { Ring } from './Ring'

type Props = {
  /** Valor principal (normalmente um <Amount>). */
  value: ReactNode
  label: string
  /** Proporção do anel (0..1; acima de 1 = cheio, com `overflowColor`). */
  ring: number
  color: string
  overflowColor?: string
  icon: LucideIcon
  /** Texto acessível do anel (sem valores quando ocultos). */
  ringLabel: string
  to?: string
  className?: string
}

/** Cartão pequeno: valor, rótulo e um anel com ícone. Três lado a lado no Início. */
export function RingCard({ value, label, ring, color, overflowColor, icon: Icon, ringLabel, to, className = '' }: Props) {
  const body = (
    <>
      <span className="block min-w-0 truncate text-[16px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[20px] lg:text-[22px]">{value}</span>
      <span className="mt-0.5 block truncate text-[13px] font-semibold text-muted">{label}</span>
      <Ring value={ring} size={64} stroke={8} color={color} overflowColor={overflowColor} ariaLabel={ringLabel} className="mt-3 self-center">
        <Icon className="size-5" style={{ color }} aria-hidden="true" />
      </Ring>
    </>
  )
  const cls = `flex min-w-0 flex-col rounded-[24px] bg-surface p-3 sm:rounded-card sm:p-4 ${className}`
  if (!to) return <div className={cls}>{body}</div>
  return (
    <Link to={to} className={`${cls} transition hover:bg-surface-2 active:scale-[0.98]`}>{body}</Link>
  )
}
