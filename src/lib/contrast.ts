function channel(v: number) {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
const INK_LUM = luminance('#110e24')

/** true quando o texto escuro (ink) contrasta mais com a cor que o branco. */
export function onCardDark(color: string) {
  const l = luminance(color)
  return (l + 0.05) / (INK_LUM + 0.05) > 1.05 / (l + 0.05)
}
