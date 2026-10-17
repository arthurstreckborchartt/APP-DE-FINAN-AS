import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export function QueryError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface p-6 text-center">
      <AlertTriangle className="size-8 text-danger" aria-hidden="true" />
      <p className="text-sm text-muted">{t('common.errorGeneric')}</p>
      <Button variant="secondary" className="h-10" onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  )
}
