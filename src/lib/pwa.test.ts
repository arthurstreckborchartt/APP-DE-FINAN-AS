import { describe, expect, test } from 'vitest'
import { isIos, isStandalone } from './pwa'

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
