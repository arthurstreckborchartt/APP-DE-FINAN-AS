import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  clearInstallPromptEvent, getInstallPromptEvent, isIos, isStandalone, subscribeInstallPrompt,
} from './pwa'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile'

describe('isIos', () => {
  test('iPhone', () => expect(isIos(IPHONE, 5)).toBe(true))
  test('iPad com UA de desktop', () => expect(isIos(IPAD_DESKTOP, 5)).toBe(true))
  test('Mac de verdade', () => expect(isIos(IPAD_DESKTOP, 0)).toBe(false))
  test('Android', () => expect(isIos(ANDROID, 5)).toBe(false))
})

describe('isStandalone', () => {
  const mm = (matches: boolean) => () => ({ matches })
  test('display-mode standalone', () => expect(isStandalone(mm(true))).toBe(true))
  test('navigator.standalone do iOS', () => expect(isStandalone(mm(false), true)).toBe(true))
  test('navegador comum', () => expect(isStandalone(mm(false), false)).toBe(false))
})

describe('armazenamento do beforeinstallprompt', () => {
  afterEach(() => clearInstallPromptEvent())

  test('captura o evento, impede o mini-infobar e avisa os inscritos', () => {
    const cb = vi.fn()
    const unsubscribe = subscribeInstallPrompt(cb)
    const evt = new Event('beforeinstallprompt', { cancelable: true })
    window.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
    expect(getInstallPromptEvent()).toBe(evt)
    expect(cb).toHaveBeenCalledTimes(1)
    unsubscribe()
    clearInstallPromptEvent()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('appinstalled limpa o evento guardado', () => {
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    window.dispatchEvent(new Event('appinstalled'))
    expect(getInstallPromptEvent()).toBeNull()
  })
})
