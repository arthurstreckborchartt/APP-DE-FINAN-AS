import { describe, expect, it } from 'vitest'
import { inviteUrl } from './api'

describe('inviteUrl', () => {
  it('monta o link /join/<token> com a origem dada', () => {
    expect(inviteUrl('abc123', 'https://app.example')).toBe('https://app.example/join/abc123')
  })

  it('usa a origem da página por padrão', () => {
    expect(inviteUrl('t')).toBe(`${window.location.origin}/join/t`)
  })
})
