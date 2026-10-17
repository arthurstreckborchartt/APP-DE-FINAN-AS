import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = { icon: LucideIcon; title: string; description?: string; action?: ReactNode }

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-[20px] bg-bg text-primary dark:bg-surface-2">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <p className="text-lg font-extrabold tracking-[-0.02em]">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  )
}
