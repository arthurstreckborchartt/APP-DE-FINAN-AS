import { describe, expect, it } from 'vitest'
import { onCardDark } from './contrast'

describe('onCardDark', () => {
  it('usa texto escuro em cores claras', () => expect(onCardDark('#eab308')).toBe(true))
  it('usa texto branco em cores escuras', () => expect(onCardDark('#5b3df5')).toBe(false))
})
