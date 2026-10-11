import { CreditCard, House, Landmark, ReceiptText, Plus, Tags, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; labelKey: string; icon: LucideIcon; primary?: boolean; sidebarOnly?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ReceiptText },
  { to: '/new', labelKey: 'nav.new', icon: Plus, primary: true },
  { to: '/cards', labelKey: 'cards.title', icon: CreditCard },
  { to: '/accounts', labelKey: 'accounts.title', icon: Landmark },
  { to: '/categories', labelKey: 'categories.title', icon: Tags, sidebarOnly: true },
]
