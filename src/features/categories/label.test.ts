import { expect, test } from 'vitest'
import { categoryLabel } from './label'

const t = (key: string) => `T(${key})`

test('categoria própria usa o nome', () => expect(categoryLabel({ name: 'Café', i18n_key: null }, t)).toBe('Café'))
test('categoria padrão usa a tradução', () =>
  expect(categoryLabel({ name: null, i18n_key: 'food' }, t)).toBe('T(categories.system.food)'))
