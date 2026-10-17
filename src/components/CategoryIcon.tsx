import { Tag } from 'lucide-react'
import { CATEGORY_ICONS } from '../features/categories/icons'

type Props = { icon: string; color: string; size?: 'sm' | 'md' }

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const Icon = Object.hasOwn(CATEGORY_ICONS, icon) ? CATEGORY_ICONS[icon] : Tag
  const box = size === 'sm' ? 'size-9 rounded-xl' : 'size-11 rounded-[14px]'
  const glyph = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span className={`grid ${box} shrink-0 place-items-center`}
      style={{ backgroundColor: `${color}1f`, color }}>
      <Icon className={glyph} aria-hidden="true" />
    </span>
  )
}
