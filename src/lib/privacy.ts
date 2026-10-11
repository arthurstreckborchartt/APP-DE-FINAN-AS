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

export function setHideValues(next: boolean): void {
  hidden = next
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
