import { Tag } from 'lucide-react'
import { CATEGORY_ICONS } from '../features/categories/icons'

type Props = { icon: string; color: string; size?: 'sm' | 'md' }

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag
  const box = size === 'sm' ? 'size-8' : 'size-10'
  const glyph = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-full`}
      style={{ backgroundColor: `${color}26`, color }}>
      <Icon className={glyph} aria-hidden="true" />
    </span>
  )
}
