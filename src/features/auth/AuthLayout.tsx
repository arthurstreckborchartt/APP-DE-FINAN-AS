import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from '../../components/BrandMark'
import { APP_NAME } from '../../config'
import { LanguageSelect } from '../../components/LanguageSelect'

type Props = { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }

/** Entrada limpa: chão branco, marca no topo, título grande e o formulário direto, sem painel. */
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-full flex-col bg-bg px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 lg:max-w-5xl">
        <BrandMark size={32} />
        <LanguageSelect />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-[-0.035em] text-balance">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] font-medium text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-center text-sm font-medium text-muted">{footer}</div>}
      </main>
      <footer className="mx-auto w-full max-w-md text-center text-[13px] font-medium text-muted lg:max-w-5xl">
        {t('auth.tagline')} · © {APP_NAME}
      </footer>
    </div>
  )
}
