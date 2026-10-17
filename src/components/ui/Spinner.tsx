import { useTranslation } from 'react-i18next'

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[3px] border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

export function FullScreenSpinner() {
  const { t } = useTranslation()
  return (
    <div className="grid h-full place-items-center text-primary" role="status">
      <Spinner className="size-8" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
