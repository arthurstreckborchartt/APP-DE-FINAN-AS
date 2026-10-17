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
        className="h-13 field rounded-[18px] px-4 text-base font-semibold text-fg outline-none transition
          placeholder:font-medium placeholder:text-muted hover:bg-surface-2 focus:ring-2 focus:ring-primary dark:bg-surface-2 dark:hover:bg-surface-3
          aria-invalid:ring-2 aria-invalid:ring-danger disabled:opacity-60"
        {...rest}
      />
      {error && <p id={errorId} className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  )
}
