/** Erro do Postgres 23503: o registro ainda é usado por outro (ex.: conta com lançamentos). */
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23503'
}
