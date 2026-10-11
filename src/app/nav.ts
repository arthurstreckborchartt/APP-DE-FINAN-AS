import { CreditCard, House, ReceiptText, Plus, Users, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; labelKey: string; icon: LucideIcon; primary?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ReceiptText },
  { to: '/new', labelKey: 'nav.new', icon: Plus, primary: true },
  { to: '/cards', labelKey: 'nav.cards', icon: CreditCard },
  { to: '/groups', labelKey: 'nav.groups', icon: Users },
]
