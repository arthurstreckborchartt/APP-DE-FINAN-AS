import { expect, test } from 'vitest'
import { initials } from './initials'

test('duas primeiras iniciais em maiúsculas; sem nome, um ponto', () => {
  expect(initials('Ana Souza')).toBe('AS')
  expect(initials('  bruno  lima dias ')).toBe('BL')
  expect(initials('Carla')).toBe('C')
  expect(initials('')).toBe('·')
  expect(initials(undefined)).toBe('·')
})
