import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg shadow-float hover:bg-primary-strong active:scale-[0.98]',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 active:scale-[0.98]',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
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
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold tracking-[-0.01em] transition duration-150
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
