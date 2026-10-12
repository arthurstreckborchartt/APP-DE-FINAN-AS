import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Junta classes do Tailwind resolvendo conflitos (padrão dos componentes shadcn). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
