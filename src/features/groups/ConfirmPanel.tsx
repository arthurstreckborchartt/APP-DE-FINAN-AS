import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'

type Props = {
  message: string
  confirmLabel: string
  loading?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmação no lugar (dentro de folhas e listas), com a frase completa da ação. */
export function ConfirmPanel({ message, confirmLabel, loading, danger, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  // O botão que abriu a confirmação some; o foco vai para a ação confirmada.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>('[data-confirm]')?.focus()
  }, [])
  return (
    <div ref={panelRef} role="group" aria-label={confirmLabel} className="rounded-[20px] bg-surface-2 p-4">
      <p className="text-sm font-semibold">{message}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="plain" className="h-11 px-4" disabled={loading} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button data-confirm type="button" variant={danger ? 'plainDanger' : 'primary'} className="h-11 px-4"
          loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
