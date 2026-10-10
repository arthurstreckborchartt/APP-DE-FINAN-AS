import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../i18n'
import { InstallPrompt } from './InstallPrompt'

function mockMatchMedia(standalone: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('standalone') ? standalone : false,
    addEventListener: () => {}, removeEventListener: () => {},
  }))
}

describe('InstallPrompt', () => {
  beforeEach(() => { localStorage.clear(); mockMatchMedia(false) })
  afterEach(() => vi.unstubAllGlobals())

  test('não aparece sem evento de instalação em navegador não-iOS', () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('aparece após beforeinstallprompt e chama prompt() ao clicar', async () => {
    render(<InstallPrompt />)
    const prompt = vi.fn().mockResolvedValue(undefined)
    const evt = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    act(() => { window.dispatchEvent(evt) })
    await userEvent.click(screen.getByRole('button', { name: /instalar|install|instala/i }))
    expect(prompt).toHaveBeenCalled()
  })

  test('não aparece quando já instalado', () => {
    mockMatchMedia(true)
    render(<InstallPrompt />)
    act(() => { window.dispatchEvent(new Event('beforeinstallprompt')) })
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('"Agora não" esconde e lembra', async () => {
    render(<InstallPrompt />)
    act(() => { window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt: vi.fn() })) })
    await userEvent.click(screen.getByRole('button', { name: /agora não|not now|ahora no/i }))
    expect(screen.queryByRole('region')).toBeNull()
    expect(localStorage.getItem('install-dismissed')).toBe('1')
  })
})
