import { createElement } from 'react'
import { categoryGlyph } from '../features/categories/icons'

type Props = { icon: string; color: string; size?: 'sm' | 'md' }

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const box = size === 'sm' ? 'size-9 rounded-xl' : 'size-11 rounded-[14px]'
  const glyph = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span className={`grid ${box} shrink-0 place-items-center`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
      {createElement(categoryGlyph(icon), { className: glyph, 'aria-hidden': true })}
    </span>
  )
}
