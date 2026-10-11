import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string }

export function SelectField({ label, id, className = '', children, ...rest }: Props) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className="text-[13px] font-semibold text-muted">{label}</label>
      <div className="relative">
        <select
          id={selectId}
          className="h-12 w-full appearance-none rounded-2xl border border-transparent bg-surface-2 pl-4 pr-11 text-base font-medium text-fg
            outline-none transition hover:bg-surface-3 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
    </div>
  )
}
