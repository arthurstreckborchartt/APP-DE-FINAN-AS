import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'

export default function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <section>
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{t(titleKey)}</h1>
      <div className="mt-6 flex flex-col items-center gap-3 rounded-[24px] bg-surface p-12 text-center font-medium text-muted shadow-sheet">
        <Construction className="size-8" aria-hidden="true" />
        <p>{t('common.comingSoon')}</p>
      </div>
    </section>
  )
}
