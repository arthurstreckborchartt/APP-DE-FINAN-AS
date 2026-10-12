import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Amount } from '../../components/Amount'
import { CategoryIcon } from '../../components/CategoryIcon'
import type { Account } from '../accounts/types'
import type { Card } from '../cards/types'
import { categoryLabel } from '../categories/label'
import type { Category } from '../categories/types'
import type { Transaction } from './types'

/** Lançamento ou entrada do mês; `installment_number` só existe nas parcelas de cartão. */
type Entry = Transaction & { installment_number?: number }

type Props = { transaction: Entry; category?: Category; account?: Account; card?: Card; locale: string }

export function TransactionRow({ transaction: tx, category, account, card, locale }: Props) {
  const { t } = useTranslation()
  const label = category ? categoryLabel(category, t) : ''
  const income = tx.kind === 'income'
  const installment = tx.installments_count > 1
  return (
    <Link to={`/transactions/${tx.id}/edit`}
      className="group flex items-center gap-3.5 rounded-2xl px-3 py-3 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
      {category && <CategoryIcon icon={category.icon} color={category.color} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">{tx.description || label}</span>
        <span className="block truncate text-[13px] font-medium text-muted">
          {tx.description ? `${label} · ` : ''}{account?.name ?? card?.name ?? ''}
        </span>
      </span>
      {installment && (
        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-extrabold text-muted num">
          {tx.installment_number !== undefined
            ? t('transactions.installmentBadge', { n: tx.installment_number, total: tx.installments_count })
            : t('transactions.installmentsHidden', { count: tx.installments_count })}
        </span>
      )}
      <Amount cents={tx.amount} currency={tx.currency} locale={locale} sign={tx.kind}
        className={`shrink-0 text-[15px] font-bold ${income ? 'text-success' : 'text-fg'}`} />
    </Link>
  )
}
