import {
  Baby, BookOpen, Briefcase, Car, CircleEllipsis, Coffee, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap,
  Heart, HeartPulse, Home, Landmark, Laptop, Lightbulb, Music, PartyPopper, PawPrint, PiggyBank, Plane, Receipt, Repeat,
  Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Tag, TrendingUp, Umbrella, Utensils, Wallet, Wrench,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-cart': ShoppingCart, car: Car, home: Home, lightbulb: Lightbulb,
  'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap, 'party-popper': PartyPopper,
  'shopping-bag': ShoppingBag, repeat: Repeat, plane: Plane, 'paw-print': PawPrint, landmark: Landmark,
  'circle-ellipsis': CircleEllipsis, briefcase: Briefcase, laptop: Laptop, 'trending-up': TrendingUp, gift: Gift,
  coffee: Coffee, dumbbell: Dumbbell, baby: Baby, shirt: Shirt, smartphone: Smartphone, fuel: Fuel,
  'book-open': BookOpen, music: Music, film: Film, wrench: Wrench, 'piggy-bank': PiggyBank, wallet: Wallet,
  receipt: Receipt, 'gamepad-2': Gamepad2, sparkles: Sparkles, tag: Tag,
  heart: Heart, umbrella: Umbrella,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS)

export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b', '#94a3b8',
]

/** Glifo de uma categoria pelo nome (desconhecido → etiqueta). */
export function categoryGlyph(icon: string): LucideIcon {
  return Object.hasOwn(CATEGORY_ICONS, icon) ? CATEGORY_ICONS[icon] : Tag
}
