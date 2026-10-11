import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Share, X } from 'lucide-react'
import {
  clearInstallPromptEvent, getInstallPromptEvent, isIos, isStandalone, subscribeInstallPrompt,
} from '../lib/pwa'
import { Button } from './ui/Button'

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
  const deferred = useSyncExternalStore(subscribeInstallPrompt, getInstallPromptEvent, () => null)
  const [dismissed, setDismissed] = useState(readDismissed)

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
    try {
      await deferred.prompt()
    } catch {
      // prompt() só pode ser usado uma vez; se falhar, o evento já não serve
    } finally {
      clearInstallPromptEvent()
    }
  }

  return (
    <section aria-label={t('install.title')}
      className="mb-5 flex items-start gap-3 rounded-[24px] bg-primary-soft p-4">
      <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{t('install.title')}</p>
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
