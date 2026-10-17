import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'plain' | 'plainDanger' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-ink-fg hover:bg-ink-hover active:scale-[0.98]',
  secondary: 'bg-surface text-fg hover:bg-surface-2 active:scale-[0.98]',
  /** Pílula branca (preta no escuro), para ficar visível sobre um painel Cloud. */
  plain: 'bg-bg text-fg hover:bg-surface-3 active:scale-[0.98]',
  plainDanger: 'bg-bg text-danger hover:bg-surface-3 active:scale-[0.98]',
  ghost: 'bg-transparent text-fg hover:bg-surface',
  danger: 'bg-transparent text-danger hover:bg-danger/10',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  loading?: boolean
  full?: boolean
}

export function Button({ variant = 'primary', loading = false, full = false, className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex h-13 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold tracking-[-0.01em] transition duration-150
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
