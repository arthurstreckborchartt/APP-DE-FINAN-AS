import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'

/**
 * Peças de layout do mundo Cal AI. Cartões Cloud planos (28px, sem sombra, sem borda) sobre chão branco;
 * listas como linhas Cloud arredondadas; ícones em ladrilhos quadrados arredondados.
 */

export function Card({ children, className = '', as: Tag = 'section' }: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Tag className={`rounded-card bg-surface p-5 sm:p-6 ${className}`}>{children}</Tag>
}

/** Título de página: grande, pesado, sem eyebrow. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.035em] text-balance lg:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] font-medium text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

/** Cabeçalho de seção: fica sobre o chão branco (fora do cartão) ou no topo de um cartão. */
export function SectionHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <h2 id={id} className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</h2>
      {action}
    </div>
  )
}

/** Link "Ver todos" de uma seção. */
export function SeeAllLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-3 text-sm font-bold text-primary transition hover:bg-primary-soft">
      {children} <ChevronRight className="size-4" aria-hidden="true" />
    </Link>
  )
}

/** Lista de linhas Cloud separadas (o padrão de lista do app). */
export function RowList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <ul className={`flex flex-col gap-2 ${className}`}>{children}</ul>
}

/** Uma linha Cloud arredondada; o conteúdo (link/botão) recebe o hover. */
export function RowItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <li className={`overflow-hidden rounded-[22px] bg-surface ${className}`}>{children}</li>
}

/** Ladrilho quadrado arredondado para ícones que não são de categoria. */
export function IconTile({ icon: Icon, color, size = 'md', className = '' }: {
  icon: LucideIcon
  /** Cor do glifo e do fundo tingido; sem cor, ladrilho neutro. */
  color?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const box = size === 'sm' ? 'size-9 rounded-xl' : 'size-11 rounded-[14px]'
  return (
    <span className={`grid ${box} shrink-0 place-items-center ${color ? '' : 'bg-bg text-fg dark:bg-surface-2'} ${className}`}
      style={color ? { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color } : undefined} aria-hidden="true">
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} />
    </span>
  )
}
