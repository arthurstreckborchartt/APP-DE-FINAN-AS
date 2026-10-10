import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../i18n'
import { clearInstallPromptEvent } from '../lib/pwa'
import { InstallPrompt } from './InstallPrompt'

function installEvent(prompt = vi.fn().mockResolvedValue(undefined)) {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome: 'accepted' }),
  })
}

function mockMatchMedia(standalone: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('standalone') ? standalone : false,
    addEventListener: () => {}, removeEventListener: () => {},
  }))
}

describe('InstallPrompt', () => {
  beforeEach(() => { localStorage.clear(); mockMatchMedia(false); clearInstallPromptEvent() })
  afterEach(() => { cleanup(); clearInstallPromptEvent(); vi.unstubAllGlobals() })

  test('não aparece sem evento de instalação em navegador não-iOS', () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('aparece após beforeinstallprompt e chama prompt() ao clicar', async () => {
    render(<InstallPrompt />)
    const prompt = vi.fn().mockResolvedValue(undefined)
    const evt = installEvent(prompt)
    act(() => { window.dispatchEvent(evt) })
    expect(evt.defaultPrevented).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: /instalar|install|instala/i }))
    expect(prompt).toHaveBeenCalled()
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('usa o evento disparado antes de montar', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    window.dispatchEvent(installEvent(prompt))
    render(<InstallPrompt />)
    await userEvent.click(screen.getByRole('button', { name: /instalar|install|instala/i }))
    expect(prompt).toHaveBeenCalled()
  })

  test('falha em prompt() não quebra e esconde o aviso', async () => {
    render(<InstallPrompt />)
    act(() => { window.dispatchEvent(installEvent(vi.fn().mockRejectedValue(new Error('já usado')))) })
    await userEvent.click(screen.getByRole('button', { name: /instalar|install|instala/i }))
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('não aparece quando já instalado', () => {
    mockMatchMedia(true)
    render(<InstallPrompt />)
    act(() => { window.dispatchEvent(installEvent()) })
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('"Agora não" esconde e lembra', async () => {
    render(<InstallPrompt />)
    act(() => { window.dispatchEvent(installEvent()) })
    await userEvent.click(screen.getByRole('button', { name: /agora não|not now|ahora no/i }))
    expect(screen.queryByRole('region')).toBeNull()
    expect(localStorage.getItem('install-dismissed')).toBe('1')
  })
})
