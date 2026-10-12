import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { TiltCard } from '@/components/ui/TiltCard'
import { onCardDark } from '../../lib/contrast'
import type { CardWithLimit } from './types'

export function CardTile({ card, locale }: { card: CardWithLimit; locale: string }) {
  const { t } = useTranslation()
  const dark = onCardDark(card.color)
  const pct = card.limit_amount > 0 ? Math.min(100, Math.max(0, (card.used / card.limit_amount) * 100)) : 0
  const limitParts = t('cards.ofLimit', { limit: '__L__' }).split('__L__')
  const motif = dark ? '17 14 36' : '255 255 255'
  return (
    <div>
      <TiltCard tiltLimit={10} scale={1.03} className="rounded-[22px] shadow-sheet">
      <Link to={`/cards/${card.id}`}
        className={`relative block aspect-[1.586] overflow-hidden rounded-[22px] p-5 transition active:scale-[0.99] ${dark ? 'text-[#110e24]' : 'text-white'}`}
        style={{
          backgroundColor: card.color,
          backgroundImage: [
            `radial-gradient(circle at calc(100% - 5rem) 2.5rem, rgb(${motif} / 0.14) 0 4.5rem, transparent 4.55rem)`,
            `radial-gradient(circle at calc(100% - 1.5rem) 2.5rem, rgb(${motif} / 0.1) 0 4.5rem, transparent 4.55rem)`,
          ].join(','),
        }}>
        {card.archived && (
          <span className={`absolute bottom-12 left-5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${dark ? 'bg-white/70 text-[#110e24]' : 'bg-black/45 text-white'}`}>{t('common.archived')}</span>
        )}
        <span className="block max-w-[75%] truncate text-lg font-extrabold tracking-[-0.01em]">{card.name}</span>
        <span className="mt-1 block text-[13px] font-bold">{card.currency}</span>
        <span className="absolute inset-x-5 bottom-4 block text-[13px] font-semibold">
          {t('cards.closesOn', { day: card.closing_day })} · {t('cards.dueOn', { day: card.due_day })}
        </span>
      </Link>
      </TiltCard>
      <div className="mt-3 px-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img"
          aria-label={`${t('cards.used')}: ${Math.round(pct)}%`}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: card.color }} />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-muted">{t('cards.available')}</span>
          <span className="text-[13px] font-medium text-muted">
            <Amount cents={card.available} currency={card.currency} locale={locale} className="text-[15px] font-extrabold text-fg" />{' '}
            {limitParts[0]}<Amount cents={card.limit_amount} currency={card.currency} locale={locale} />{limitParts[1]}
          </span>
        </div>
      </div>
    </div>
  )
}
