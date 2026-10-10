import type { Category } from './types'

export function categoryLabel(cat: Pick<Category, 'name' | 'i18n_key'>, t: (key: string) => string): string {
  return cat.name ?? t(`categories.system.${cat.i18n_key}`)
}
