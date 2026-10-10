import { useId, type SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string }

export function SelectField({ label, id, className = '', children, ...rest }: Props) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className="text-sm font-medium text-fg">{label}</label>
      <select
        id={selectId}
        className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-fg outline-none transition
          focus:border-primary focus:ring-2 focus:ring-primary/25"
        {...rest}
      >
        {children}
      </select>
    </div>
  )
}
