import { expect, test, vi } from 'vitest'
import { fetchAllPages, MAX_PAGES } from './paginate'

/** Consulta falsa sobre `total` linhas numeradas, que respeita o intervalo pedido. */
function fakeBuilder(total: number) {
  return vi.fn(async (from: number, to: number) => {
    const data: number[] = []
    for (let i = from; i <= to && i < total; i += 1) data.push(i)
    return { data, error: null }
  })
}

test('2 páginas cheias + 1 curta: concatena na ordem e para', async () => {
  const build = fakeBuilder(25)
  const rows = await fetchAllPages(build, 10)
  expect(rows).toEqual(Array.from({ length: 25 }, (_, i) => i))
  expect(build).toHaveBeenCalledTimes(3)
  expect(build.mock.calls.map((c) => c.slice(0, 2))).toEqual([[0, 9], [10, 19], [20, 29]])
})

test('para numa página vazia', async () => {
  const build = fakeBuilder(20)
  const rows = await fetchAllPages(build, 10)
  expect(rows).toHaveLength(20)
  expect(build).toHaveBeenCalledTimes(3)
})

test('respeita o limite de páginas', async () => {
  const build = fakeBuilder(Number.POSITIVE_INFINITY)
  const rows = await fetchAllPages(build, 2)
  expect(build).toHaveBeenCalledTimes(MAX_PAGES)
  expect(rows).toHaveLength(MAX_PAGES * 2)
})

test('propaga o erro da consulta', async () => {
  const error = new Error('boom')
  await expect(fetchAllPages(async () => ({ data: null, error }))).rejects.toBe(error)
})
