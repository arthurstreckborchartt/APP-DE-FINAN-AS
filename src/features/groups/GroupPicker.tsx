import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { CurrencyCode } from '../../lib/money'
import { CHIP } from '../../components/ui/Chip'
import { useMyGroups } from './api'
import { GroupIcon } from './GroupIcon'

type Props = {
  value: string | null
  onChange: (groupId: string | null) => void
  /** Moeda da origem escolhida (conta ou cartão); `undefined` enquanto não há origem. */
  currency: CurrencyCode | undefined
}

/** Escolha do grupo de um lançamento ou recorrente. Só grupos na moeda da origem podem ser marcados. */
export function GroupPicker({ value, onChange, currency }: Props) {
  const { t } = useTranslation()
  const { data: groups } = useMyGroups()

  const selected = groups?.find((g) => g.id === value)
  // Trocar a origem para outra moeda tira o grupo incompatível.
  useEffect(() => {
    if (selected && currency && selected.currency !== currency) onChange(null)
  }, [selected, currency, onChange])

  if (!groups) return null
  if (groups.length === 0 && value === null) return null

  // Grupo que não está mais na lista (a pessoa saiu dele): continua marcado até escolher outro.
  const former = value !== null && !selected
  const someDisabled = !!currency && groups.some((g) => g.currency !== currency)

  return (
    <fieldset>
      <legend className="mb-3 text-[13px] font-semibold text-muted">{t('groups.field')}</legend>
      <div className="flex flex-wrap gap-2">
        <label className={CHIP}>
          <input type="radio" name="group" className="sr-only" checked={value === null} onChange={() => onChange(null)} />
          {t('groups.none')}
        </label>
        {former && (
          <label className={CHIP}>
            <input type="radio" name="group" className="sr-only" checked readOnly />
            {t('groups.formerGroup')}
          </label>
        )}
        {groups.map((g) => (
          <label key={g.id} className={`${CHIP} pl-1`}>
            <input type="radio" name="group" className="sr-only" value={g.id} checked={value === g.id}
              disabled={!!currency && g.currency !== currency} onChange={() => onChange(g.id)} />
            <GroupIcon name={g.icon} size="sm" />
            <span className="max-w-[12rem] truncate">{g.name}</span>
          </label>
        ))}
      </div>
      {someDisabled && (
        <p className="mt-2 text-[13px] font-medium text-muted">{t('groups.groupCurrencyHint', { currency })}</p>
      )}
    </fieldset>
  )
}
