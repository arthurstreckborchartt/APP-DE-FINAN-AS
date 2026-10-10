export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  // iPadOS 13+ se identifica como Macintosh, mas tem tela touch
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export function isStandalone(
  matchMedia: (q: string) => { matches: boolean },
  navigatorStandalone?: boolean,
): boolean {
  return matchMedia('(display-mode: standalone)').matches || navigatorStandalone === true
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// O navegador pode disparar beforeinstallprompt antes do React montar o aviso,
// então o evento é capturado já na importação deste módulo (ver main.tsx).
let installPromptEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const cb of listeners) cb()
}

export function getInstallPromptEvent(): BeforeInstallPromptEvent | null {
  return installPromptEvent
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function clearInstallPromptEvent(): void {
  if (!installPromptEvent) return
  installPromptEvent = null
  notify()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPromptEvent = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => clearInstallPromptEvent())
}
