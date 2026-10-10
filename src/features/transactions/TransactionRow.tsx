import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CategoryIcon } from '../../components/CategoryIcon'
import { formatMoney } from '../../lib/money'
import type { Account } from '../accounts/types'
import { categoryLabel } from '../categories/label'
import type { Category } from '../categories/types'
import type { Transaction } from './types'

type Props = { transaction: Transaction; category?: Category; account?: Account; locale: string }

export function TransactionRow({ transaction: tx, category, account, locale }: Props) {
  const { t } = useTranslation()
  const label = category ? categoryLabel(category, t) : ''
  const income = tx.kind === 'income'
  return (
    <Link to={`/transactions/${tx.id}/edit`}
      className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
      {category && <CategoryIcon icon={category.icon} color={category.color} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.description || label}</span>
        <span className="block truncate text-sm text-muted">
          {tx.description ? `${label} · ` : ''}{account?.name ?? ''}
        </span>
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${income ? 'text-success' : 'text-danger'}`}>
        {income ? '+' : '−'}{formatMoney(tx.amount, tx.currency, locale)}
      </span>
    </Link>
  )
}
