import { Heart, Users, type LucideIcon } from 'lucide-react'
import { CATEGORY_ICONS } from '../categories/icons'

export const GROUP_ICON_NAMES = [
  'users', 'home', 'heart', 'plane', 'utensils', 'party-popper', 'briefcase', 'car', 'graduation-cap', 'shopping-cart',
] as const

const EXTRA: Record<string, LucideIcon> = { users: Users, heart: Heart }

export function groupIconComponent(name: string): LucideIcon {
  return EXTRA[name] ?? CATEGORY_ICONS[name] ?? Users
}

export function GroupIcon({ name, size = 'md' }: { name: string; size?: 'md' | 'sm' }) {
  const Icon = groupIconComponent(name)
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-primary-soft text-primary ${size === 'md' ? 'size-11' : 'size-9'}`}>
      <Icon className={size === 'md' ? 'size-5' : 'size-4'} aria-hidden="true" />
    </span>
  )
}
