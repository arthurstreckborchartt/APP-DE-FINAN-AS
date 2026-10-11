import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { formatMoney } from '../../lib/money'
import type { CardWithLimit } from './types'

function channel(v: number) {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
const INK_LUM = luminance('#110e24')

/** true quando o texto escuro (ink) contrasta mais com a cor do cartão que o branco. */
export function onCardDark(color: string) {
  const l = luminance(color)
  return (l + 0.05) / (INK_LUM + 0.05) > 1.05 / (l + 0.05)
}

export function CardTile({ card, locale }: { card: CardWithLimit; locale: string }) {
  const { t } = useTranslation()
  const dark = onCardDark(card.color)
  const pct = card.limit_amount > 0 ? Math.min(100, Math.max(0, (card.used / card.limit_amount) * 100)) : 0
  const motif = dark ? '17 14 36' : '255 255 255'
  return (
    <div className={card.archived ? 'opacity-75' : ''}>
      <Link to={`/cards/${card.id}`}
        className={`relative block aspect-[1.586] overflow-hidden rounded-[22px] p-5 shadow-sheet transition active:scale-[0.99] ${dark ? 'text-[#110e24]' : 'text-white'}`}
        style={{
          backgroundColor: card.color,
          backgroundImage: [
            `radial-gradient(circle at calc(100% - 5rem) 2.5rem, rgb(${motif} / 0.14) 0 4.5rem, transparent 4.55rem)`,
            `radial-gradient(circle at calc(100% - 1.5rem) 2.5rem, rgb(${motif} / 0.1) 0 4.5rem, transparent 4.55rem)`,
          ].join(','),
        }}>
        <span className="block max-w-[75%] truncate text-lg font-extrabold tracking-[-0.01em]">{card.name}</span>
        <span className="mt-1 block text-[13px] font-bold">{card.currency}</span>
        <span className="absolute inset-x-5 bottom-4 block text-[13px] font-semibold">
          {t('cards.closesOn', { day: card.closing_day })} · {t('cards.dueOn', { day: card.due_day })}
        </span>
      </Link>
      <div className="mt-3 px-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img"
          aria-label={`${t('cards.used')}: ${formatMoney(card.used, card.currency, locale)}`}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: card.color }} />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-muted">{t('cards.available')}</span>
          <span className="text-[13px] font-medium text-muted">
            <Amount cents={card.available} currency={card.currency} locale={locale} className="text-[15px] font-extrabold text-fg" />{' '}
            {t('cards.ofLimit', { limit: formatMoney(card.limit_amount, card.currency, locale) })}
          </span>
        </div>
      </div>
    </div>
  )
}
