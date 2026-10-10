import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'

export default function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">{t(titleKey)}</h1>
      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
        <Construction className="size-8" aria-hidden="true" />
        <p>{t('common.comingSoon')}</p>
      </div>
    </section>
  )
}
