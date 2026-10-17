import { useEffect } from 'react'
import { isRouteErrorResponse, Navigate, useNavigate, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'

type Props = { onReload?: () => void }

/** Tela de erro das rotas: calma, sem detalhes técnicos (o erro vai só para o console). */
export function ErrorPage({ onReload = () => window.location.reload() }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) console.error(error)
  }, [error, notFound])

  if (notFound) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <EmptyState
          icon={AlertTriangle}
          title={t('errors.pageTitle')}
          description={t('errors.pageBody')}
          action={
            <div className="mt-2 flex w-full flex-col gap-3">
              <Button full onClick={onReload}>{t('errors.reload')}</Button>
              <Button full variant="ghost" onClick={() => navigate('/', { replace: true })}>{t('errors.home')}</Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
