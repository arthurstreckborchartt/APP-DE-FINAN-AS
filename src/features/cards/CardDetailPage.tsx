import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Pencil } from 'lucide-react'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner, Spinner } from '../../components/ui/Spinner'
import { isForeignKeyViolation } from '../../lib/db-errors'
import { todayISO } from '../../lib/dates'
import { invoiceStatus, type InvoiceStatus } from '../../lib/invoice'
import { normalizeLocale } from '../../lib/locale'
import { categoryLabel } from '../categories/label'
import { useCategories } from '../categories/api'
import { useCards, useDeleteCard, useUpdateCard } from './api'
import { CardForm } from './CardForm'
import { CardTile } from './CardTile'
import { useCardInvoices, useInvoiceItems, useReopenInvoice } from './invoicesApi'
import { PayInvoiceSheet } from './PayInvoiceSheet'
import type { CardInput, InvoiceSummary } from './types'

const STATUS_TEXT: Record<InvoiceStatus, string> = {
  paid: 'text-success',
  overdue: 'text-danger',
  closed: 'text-fg',
  open: 'text-primary',
}
const STATUS_DOT: Record<InvoiceStatus, string> = {
  paid: 'bg-success',
  overdue: 'bg-danger',
  closed: 'bg-warning',
  open: 'bg-primary',
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shortMonth(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number)
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o).format(new Date(y, m - 1, 1))
  const name = fmt({ month: 'short' }).replace(/\.$/, '')
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${fmt({ year: '2-digit' })}`
}

function InvoiceItems({ invoiceId, currency, locale }: { invoiceId: string; currency: string; locale: string }) {
  const { t } = useTranslation()
  const { data: items, isPending, isError, refetch } = useInvoiceItems(invoiceId)
  const { data: categories } = useCategories()
  if (isPending) return <div className="grid place-items-center py-8"><Spinner /></div>
  if (isError || !items) return <QueryError onRetry={() => void refetch()} />
  if (items.length === 0) return <p className="py-6 text-center text-sm font-medium text-muted">{t('invoices.empty')}</p>
  return (
    <ul className="flex flex-col">
      {items.map((i) => {
        const tx = i.transaction
        const cat = categories?.find((c) => c.id === tx.category_id)
        const label = cat ? categoryLabel(cat, t) : ''
        const multi = tx.installments_count > 1
        return (
          <li key={i.id}>
            <Link to={`/transactions/${tx.id}/edit`}
              className="flex items-center gap-3.5 rounded-2xl px-2 py-3 transition hover:bg-surface-2">
              <CategoryIcon icon={cat?.icon ?? 'tag'} color={cat?.color ?? '#64748b'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{tx.description || label}</span>
                <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
                  <span className="truncate">{label}</span>
                  {multi && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-fg">
                      {t('transactions.installmentBadge', { n: i.number, total: tx.installments_count })}
                    </span>
                  )}
                </span>
              </span>
              <Amount cents={i.amount} currency={currency} locale={locale} className="shrink-0 whitespace-nowrap text-[15px] font-extrabold" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function CardDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const navigate = useNavigate()
  const { data: cards, isPending, isError, refetch } = useCards()
  const invoicesQuery = useCardInvoices(id)
  const update = useUpdateCard()
  const remove = useDeleteCard()
  const reopen = useReopenInvoice()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reopenErrorId, setReopenErrorId] = useState<string | null>(null)
  const [action, setAction] = useState<'save' | 'archive' | 'delete' | null>(null)
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const today = todayISO()
  const invoices: InvoiceSummary[] = invoicesQuery.data ?? []
  // Padrão: a fatura não paga mais antiga com valor (vencidas primeiro), senão a próxima a fechar, senão a última.
  const fallback = invoices.find((i) => !i.paid_at && i.total > 0)
    ?? invoices.find((i) => !i.paid_at && i.closing_date >= today)
    ?? invoices[invoices.length - 1]
  const selected = invoices.find((i) => i.id === chosenId) ?? fallback
  const selectedId = selected?.id

  useEffect(() => {
    if (selectedId) pillRefs.current[selectedId]?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [selectedId])

  if (isPending) return <FullScreenSpinner />
  if (isError || !cards) return <QueryError onRetry={() => void refetch()} />
  const card = cards.find((c) => c.id === id)
  if (!card) return <Navigate to="/cards" replace />

  const busy = update.isPending || remove.isPending

  function openEdit() {
    setError(null)
    setConfirmDelete(false)
    setEditing(true)
  }

  async function save(value: CardInput) {
    setError(null)
    setConfirmDelete(false)
    setAction('save')
    try {
      await update.mutateAsync({
        id: card!.id,
        patch: { name: value.name, limit_amount: value.limit_amount, closing_day: value.closing_day, due_day: value.due_day, color: value.color },
      })
      setEditing(false)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function toggleArchive() {
    setError(null)
    setConfirmDelete(false)
    setAction('archive')
    try {
      await update.mutateAsync({ id: card!.id, patch: { archived: !card!.archived } })
      setEditing(false)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function destroy() {
    setError(null)
    if (!confirmDelete) return setConfirmDelete(true)
    setAction('delete')
    try {
      await remove.mutateAsync(card!.id)
      setEditing(false)
      void navigate('/cards', { replace: true })
    } catch (e) {
      setConfirmDelete(false)
      setError(t(isForeignKeyViolation(e) ? 'cards.deleteBlocked' : 'common.errorGeneric'))
    }
  }

  async function undoPayment(inv: InvoiceSummary) {
    setReopenErrorId(null)
    try {
      await reopen.mutateAsync(inv.id)
    } catch {
      setReopenErrorId(inv.id)
    }
  }

  function onPillKey(e: KeyboardEvent, index: number) {
    const last = invoices.length - 1
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    if (next < 0) return
    e.preventDefault()
    setChosenId(invoices[next].id)
    pillRefs.current[invoices[next].id]?.focus()
  }

  const dayMonth = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(parseISO(iso))
  const status = selected ? invoiceStatus(selected, today) : null
  const pct = card.limit_amount > 0 ? Math.min(100, Math.max(0, (card.used / card.limit_amount) * 100)) : 0

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link to="/cards" className="inline-flex h-11 items-center gap-1 rounded-full pr-3 text-sm font-bold text-muted hover:text-fg">
          <ChevronLeft className="size-5" aria-hidden="true" /> {t('common.back')}
        </Link>
        <Button variant="secondary" className="h-11" onClick={openEdit}>
          <Pencil className="size-4" aria-hidden="true" /> {t('common.edit')}
        </Button>
      </div>

      <div className="mx-auto mt-4 max-w-md">
        <CardTile card={card} locale={locale} />
        <div className="mt-1 flex items-baseline justify-between gap-2 px-1">
          <span className="text-[13px] font-semibold text-muted">{t('cards.used')} · {Math.round(pct)}%</span>
          <Amount cents={card.used} currency={card.currency} locale={locale} className="text-[15px] font-extrabold" />
        </div>
      </div>

      <h2 className="mt-8 text-lg font-extrabold tracking-[-0.02em]">{t('invoices.title')}</h2>

      {invoicesQuery.isPending ? (
        <div className="grid place-items-center py-10"><Spinner /></div>
      ) : invoicesQuery.isError ? (
        <QueryError onRetry={() => void invoicesQuery.refetch()} />
      ) : invoices.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm font-medium text-muted">{t('invoices.empty')}</p>
      ) : (
        <>
          <div role="radiogroup" aria-label={t('invoices.title')}
            className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
            {invoices.map((inv, index) => {
              const st = invoiceStatus(inv, today)
              const isSel = selected?.id === inv.id
              return (
                <button key={inv.id} type="button" role="radio" aria-checked={isSel}
                  tabIndex={isSel ? 0 : -1}
                  ref={(el) => { pillRefs.current[inv.id] = el }}
                  onClick={() => setChosenId(inv.id)}
                  onKeyDown={(e) => onPillKey(e, index)}
                  className={`flex shrink-0 flex-col items-start rounded-2xl px-4 py-2.5 text-left transition
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                    ${isSel ? 'bg-surface shadow-sheet ring-2 ring-fg' : 'bg-surface-2 hover:bg-surface-3'}`}>
                  <span className="text-[15px] font-extrabold">{shortMonth(inv.reference_month, locale)}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${STATUS_TEXT[st]}`}>
                    <span className={`size-2 rounded-full ${STATUS_DOT[st]}`} aria-hidden="true" />
                    {t(`invoices.status.${st}`)}
                  </span>
                </button>
              )
            })}
          </div>

          {selected && status && (
            <div className="mt-4 rounded-[24px] bg-surface p-5 shadow-sheet">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${STATUS_TEXT[status]}`}>
                    <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                    {t(`invoices.status.${status}`)}
                  </span>
                  <p className="mt-1 text-[13px] font-semibold text-muted">{t('invoices.total')}</p>
                  <Amount cents={selected.total} currency={selected.currency} locale={locale}
                    className="block text-[34px] font-extrabold tracking-[-0.03em]" />
                </div>
                <div className="shrink-0 text-right text-[13px] font-medium text-muted">
                  <p>{t('invoices.closes', { date: dayMonth(selected.closing_date) })}</p>
                  <p>{t('invoices.due', { date: dayMonth(selected.due_date) })}</p>
                </div>
              </div>

              <div className="mt-4">
                {selected.paid_at ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-bold text-success">
                      {t('invoices.paidOn', { date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(selected.paid_at)) })}
                    </span>
                    <Button variant="secondary" className="h-11" loading={reopen.isPending} onClick={() => void undoPayment(selected)}>
                      {t('invoices.reopen')}
                    </Button>
                  </div>
                ) : (
                  <Button full onClick={() => setPaying(true)} disabled={selected.total <= 0}>{t('invoices.pay')}</Button>
                )}
                {reopenErrorId === selected.id && (
                  <p role="alert" className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{t('common.errorGeneric')}</p>
                )}
              </div>

              <h3 className="mt-6 text-sm font-extrabold">{t('invoices.items')}</h3>
              <div className="mt-1">
                <InvoiceItems key={selected.id} invoiceId={selected.id} currency={selected.currency} locale={locale} />
              </div>
            </div>
          )}
        </>
      )}

      {selected && !selected.paid_at && (
        <PayInvoiceSheet key={selected.id} invoice={selected} locale={locale} open={paying} onClose={() => setPaying(false)} />
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title={t('cards.edit')}>
        {editing && (
          <CardForm
            key={card.id}
            initial={card}
            currencyEditable={false}
            submitLabel={t('common.save')}
            loading={update.isPending && action === 'save'}
            error={error}
            onSubmit={(v) => void save(v)}
          >
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" loading={update.isPending && action === 'archive'} disabled={busy} onClick={() => void toggleArchive()}>
                {card.archived ? t('common.unarchive') : t('common.archive')}
              </Button>
              <Button type="button" variant="danger" loading={remove.isPending} disabled={busy} onClick={() => void destroy()}>
                {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
              </Button>
            </div>
          </CardForm>
        )}
      </Sheet>
    </section>
  )
}
