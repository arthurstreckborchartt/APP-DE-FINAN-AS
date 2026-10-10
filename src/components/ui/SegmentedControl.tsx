type Option<T extends string> = { value: T; label: string }
type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }

export function SegmentedControl<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`h-10 rounded-xl text-sm font-semibold transition ${
            o.value === value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
