import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from '../../components/BrandMark'
import { APP_NAME } from '../../config'
import { LanguageSelect } from '../../components/LanguageSelect'

type Props = { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const { t } = useTranslation()
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="brand-panel relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <BrandMark size={40} className="text-white" />
        <div className="max-w-md">
          <p className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.035em]">{t('auth.tagline')}</p>
        </div>
        <p className="text-sm font-semibold text-brand-muted">© {APP_NAME}</p>
      </aside>
      <div className="flex min-h-full flex-col px-4 py-6 sm:px-8">
        <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <BrandMark size={32} className="lg:invisible" />
          <LanguageSelect />
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] font-medium text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm font-medium text-muted">{footer}</div>}
        </main>
      </div>
    </div>
  )
}
