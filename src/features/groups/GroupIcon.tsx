import { Heart, Users, type LucideIcon } from 'lucide-react'
import { CATEGORY_ICONS } from '../categories/icons'

export const GROUP_ICON_NAMES = [
  'users', 'home', 'heart', 'plane', 'utensils', 'party-popper', 'briefcase', 'car', 'graduation-cap', 'shopping-cart',
] as const

const EXTRA: Record<string, LucideIcon> = { users: Users, heart: Heart }

export function groupIconComponent(name: string): LucideIcon {
  return EXTRA[name] ?? CATEGORY_ICONS[name] ?? Users
}

const BOX = { sm: 'size-9 rounded-xl', md: 'size-11 rounded-[14px]', lg: 'size-16 rounded-[20px]' } as const
const GLYPH = { sm: 'size-4', md: 'size-5', lg: 'size-7' } as const

/** Ladrilho quadrado arredondado do grupo, tingido de violeta (a cor de destaque). */
export function GroupIcon({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = groupIconComponent(name)
  return (
    <span className={`grid shrink-0 place-items-center bg-primary-soft text-primary ${BOX[size]}`}>
      <Icon className={GLYPH[size]} aria-hidden="true" />
    </span>
  )
}
