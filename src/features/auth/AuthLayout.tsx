import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'
import { APP_NAME } from '../../config'
import { LanguageSelect } from '../../components/LanguageSelect'

type Props = { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex min-h-full flex-col px-4 py-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <span className="inline-flex items-center gap-2 font-semibold text-primary">
          <Wallet className="size-6" aria-hidden="true" />
          {APP_NAME}
        </span>
        <LanguageSelect />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </main>
    </div>
  )
}
