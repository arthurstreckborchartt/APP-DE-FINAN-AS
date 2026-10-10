import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }

export function TextField({ label, error, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-fg">{label}</label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-fg outline-none transition
          placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger"
        {...rest}
      />
      {error && <p id={errorId} className="text-sm text-danger">{error}</p>}
    </div>
  )
}
