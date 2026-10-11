import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = { icon: LucideIcon; title: string; description?: string; action?: ReactNode }

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] bg-surface px-6 py-12 text-center shadow-sheet">
      <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <p className="text-lg font-bold tracking-[-0.01em]">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  )
}
