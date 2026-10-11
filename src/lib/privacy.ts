import { useSyncExternalStore } from 'react'

const KEY = 'hide-values'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let hidden = read()

let revealTimer: ReturnType<typeof setTimeout> | undefined

export function setHideValues(next: boolean): void {
  hidden = next
  // Liga a animação de revelar os valores só durante a troca (não a cada renderização).
  const root = document.documentElement
  root.dataset.revealing = ''
  clearTimeout(revealTimer)
  revealTimer = setTimeout(() => delete root.dataset.revealing, 400)
  try {
    localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Preferência "ocultar valores" (o olho do saldo), compartilhada por todas as telas. */
export function useHideValues(): boolean {
  return useSyncExternalStore(subscribe, () => hidden, () => false)
}
