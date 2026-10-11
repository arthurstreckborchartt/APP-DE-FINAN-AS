import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }

export function TextField({ label, error, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">{label}</label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-12 rounded-2xl border border-transparent bg-surface-2 px-4 text-base font-medium text-fg outline-none transition
          placeholder:font-normal placeholder:text-muted hover:bg-surface-3 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/15
          aria-invalid:border-danger aria-invalid:ring-danger/15 disabled:opacity-60"
        {...rest}
      />
      {error && <p id={errorId} className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  )
}
