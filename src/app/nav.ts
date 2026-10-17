import { ChartColumn, CreditCard, House, Landmark, PiggyBank, ReceiptText, Plus, Repeat, Tags, Target, Users, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; labelKey: string; icon: LucideIcon; primary?: boolean; sidebarOnly?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ReceiptText },
  { to: '/new', labelKey: 'nav.new', icon: Plus, primary: true },
  { to: '/cards', labelKey: 'cards.title', icon: CreditCard },
  { to: '/groups', labelKey: 'nav.groups', icon: Users },
  { to: '/reports', labelKey: 'reports.title', icon: ChartColumn, sidebarOnly: true },
  { to: '/budgets', labelKey: 'budgets.title', icon: Target, sidebarOnly: true },
  { to: '/goals', labelKey: 'goals.title', icon: PiggyBank, sidebarOnly: true },
  { to: '/accounts', labelKey: 'accounts.title', icon: Landmark, sidebarOnly: true },
  { to: '/categories', labelKey: 'categories.title', icon: Tags, sidebarOnly: true },
  { to: '/recurring', labelKey: 'recurring.title', icon: Repeat, sidebarOnly: true },
]
