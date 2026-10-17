import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { Ring } from '../../components/ui/Ring'
import { memberDisplayName } from './display'
import type { MemberTotal } from './stats'

type Props = {
  members: MemberTotal[]
  myId: string | undefined
  currency: string
  locale: string
  colorOf: (userId: string) => string
}

/** "Quem gastou quanto": cada pessoa com um anel da sua fatia, na mesma cor da rosca e dos gráficos. */
export function MemberShares({ members, myId, currency, locale, colorOf }: Props) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col gap-1">
      {members.map((m) => {
        const name = memberDisplayName(m, myId, t)
        return (
          <li key={m.user_id} className="flex items-center gap-3.5 py-1.5">
            <Ring value={m.share / 100} size={44} stroke={5} color={colorOf(m.user_id)}>
              <span className="num text-[11px] font-extrabold">{m.share}%</span>
            </Ring>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[15px] font-bold">{name}</span>
                {m.left && <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-muted dark:bg-surface-2">{t('groups.left')}</span>}
              </span>
              <span className="block text-[13px] font-medium text-muted">{t('groups.share', { pct: m.share })}</span>
            </span>
            <Amount cents={m.amount} currency={currency} locale={locale} className="shrink-0 text-[15px] font-bold" />
          </li>
        )
      })}
    </ul>
  )
}
