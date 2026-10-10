import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { CategoryIcon } from '../../components/CategoryIcon'
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES, CATEGORY_ICONS } from './icons'

type Value = { name: string; icon: string; color: string }
type Props = {
  initial: Value
  submitLabel: string
  loading?: boolean
  error?: string | null
  onSubmit: (value: Value) => void
  children?: ReactNode
}

export function CategoryForm({ initial, submitLabel, loading, error, onSubmit, children }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState<Value>(initial)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ ...value, name: value.name.trim() })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <CategoryIcon icon={value.icon} color={value.color} />
        <TextField className="flex-1" label={t('categories.name')} required maxLength={40}
          value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('categories.icon')}</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
          {CATEGORY_ICON_NAMES.map((name) => {
            const Icon = CATEGORY_ICONS[name]
            return (
              <label key={name} className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-line text-muted
                has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary">
                <input type="radio" name="icon" value={name} className="sr-only" checked={value.icon === name}
                  onChange={() => setValue({ ...value, icon: name })} aria-label={name} />
                <Icon className="size-5" aria-hidden="true" />
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('categories.color')}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <label key={c} className="grid size-10 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface
              has-checked:ring-2 has-checked:ring-fg" style={{ backgroundColor: c }}>
              <input type="radio" name="color" value={c} className="sr-only" checked={value.color === c}
                onChange={() => setValue({ ...value, color: c })} aria-label={c} />
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
      {children}
    </form>
  )
}
