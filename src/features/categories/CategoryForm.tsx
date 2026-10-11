import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { CategoryIcon } from '../../components/CategoryIcon'
import { onCardDark } from '../../lib/contrast'
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
          {CATEGORY_ICON_NAMES.map((name, i) => {
            const Icon = CATEGORY_ICONS[name]
            return (
              <label key={name} className="grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-transparent bg-surface-2 text-muted transition hover:bg-surface-3
                has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary
                has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface">
                <input type="radio" name="icon" value={name} className="sr-only" checked={value.icon === name}
                  onChange={() => setValue({ ...value, icon: name })} aria-label={t('categories.iconOption', { n: i + 1 })} />
                <Icon className="size-5" aria-hidden="true" />
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('categories.color')}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c, i) => (
            <label key={c} className="grid size-10 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface
              has-checked:ring-2 has-checked:ring-fg has-focus-visible:ring-2 has-focus-visible:ring-primary" style={{ backgroundColor: c }}>
              <input type="radio" name="color" value={c} className="sr-only" checked={value.color === c}
                onChange={() => setValue({ ...value, color: c })} aria-label={t('categories.colorOption', { n: i + 1 })} />
                {value.color === c && <Check className={`size-5 ${onCardDark(c) ? 'text-[#110e24]' : 'text-white'}`} aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
      {children}
    </form>
  )
}
