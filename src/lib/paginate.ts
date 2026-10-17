/** Resultado mínimo de uma consulta do Supabase (PostgREST). */
type PageResult<T> = { data: T[] | null; error: unknown }

export const MAX_PAGES = 50

/**
 * Busca todas as páginas de uma consulta: o PostgREST corta cada resposta em `max_rows` (1000).
 * `build(from, to)` monta a consulta com `.range(from, to)` (inclusivo) e uma ordem total estável.
 * Para quando uma página vem menor que `pageSize` (ou vazia), com limite de `MAX_PAGES` páginas.
 */
export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * pageSize
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw error
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}
