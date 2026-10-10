import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Share, X } from 'lucide-react'
import { isIos, isStandalone } from '../lib/pwa'
import { Button } from './ui/Button'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

const DISMISS_KEY = 'install-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const standalone = isStandalone(
    (q) => window.matchMedia(q),
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )
  const ios = isIos(navigator.userAgent, navigator.maxTouchPoints)

  if (standalone || dismissed || (!deferred && !ios)) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignora: o aviso só volta a aparecer na próxima visita
    }
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    setDeferred(null)
  }

  return (
    <section aria-label={t('install.title')}
      className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('install.title')}</p>
        <p className="mt-0.5 text-sm text-muted">
          {ios && !deferred ? (
            <><Share className="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />{t('install.iosHint')}</>
          ) : (
            t('install.body')
          )}
        </p>
        {deferred && <Button className="mt-3 h-10" onClick={install}>{t('install.button')}</Button>}
      </div>
      <button type="button" onClick={dismiss} aria-label={t('install.dismiss')}
        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2">
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  )
}
