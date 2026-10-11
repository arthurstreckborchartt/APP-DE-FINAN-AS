import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { normalizeLocale } from '../../lib/locale'
import { useProfile } from '../profile/api'
import { useCards, useCreateCard } from './api'
import { CardForm } from './CardForm'
import { CardTile } from './CardTile'
import type { CardInput, CardWithLimit } from './types'

export default function CardsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const { data: profile } = useProfile()
  const { data: cards, isPending, isError, refetch } = useCards()
  const create = useCreateCard()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isPending) return <FullScreenSpinner />
  if (isError || !cards) return <QueryError onRetry={() => void refetch()} />

  const active = cards.filter((c) => !c.archived)
  const archived = cards.filter((c) => c.archived)

  function open() {
    setError(null)
    setCreating(true)
  }

  async function save(value: CardInput) {
    setError(null)
    try {
      await create.mutateAsync(value)
      setCreating(false)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  const grid = (list: CardWithLimit[]) => (
    <ul className="grid gap-6 sm:grid-cols-2">
      {list.map((c) => <li key={c.id}><CardTile card={c} locale={locale} /></li>)}
    </ul>
  )

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t('cards.title')}</h1>
        <Button className="h-11" onClick={open}>
          <Plus className="size-5" aria-hidden="true" /> {t('cards.new')}
        </Button>
      </div>

      <div className="mt-6">
        {active.length === 0 ? (
          <EmptyState icon={CreditCard} title={t('cards.empty')} description={t('cards.emptyBody')}
            action={<Button className="h-10" onClick={open}>{t('cards.new')}</Button>} />
        ) : grid(active)}
      </div>

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer rounded-full px-2 py-2 text-sm font-bold text-muted">{t('cards.archivedSection')}</summary>
          <div className="mt-3">{grid(archived)}</div>
        </details>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('cards.new')}>
        {creating && (
          <CardForm
            initial={{ name: '', limit_amount: 0, closing_day: 5, due_day: 12, currency: profile?.currency ?? 'BRL', color: '#5b3df5' }}
            currencyEditable
            submitLabel={t('common.save')}
            loading={create.isPending}
            error={error}
            onSubmit={(v) => void save(v)}
          />
        )}
      </Sheet>
    </section>
  )
}
