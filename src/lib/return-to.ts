/** Guarda para onde voltar depois do login (só links de convite), válido por 24 h. */
const KEY = 'return-to'
const TTL_MS = 24 * 60 * 60 * 1000

const JOIN_PATH = /^\/join\/[A-Za-z0-9_-]+$/
const isAllowed = (path: unknown): path is string => typeof path === 'string' && JOIN_PATH.test(path)

export function saveReturnTo(path: string): void {
  if (!isAllowed(path)) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
  } catch {
    // Armazenamento bloqueado: só não lembra.
  }
}

/** Não apaga: quem consome chama `clearReturnTo`. */
export function readReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (!isAllowed(path) || typeof at !== 'number') return null
    // Carimbo no futuro (relógio adulterado ou trocado) conta como expirado.
    const age = Date.now() - at
    if (age < 0 || age > TTL_MS) return null
    return path
  } catch {
    return null
  }
}

export function clearReturnTo(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
