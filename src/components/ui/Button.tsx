import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:opacity-90',
  secondary: 'bg-surface-2 text-fg hover:bg-line',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  danger: 'bg-transparent text-danger hover:bg-surface-2',
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
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
