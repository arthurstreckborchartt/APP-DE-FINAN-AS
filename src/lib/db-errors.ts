type DbError = { code?: unknown; hint?: unknown }

const asDbError = (error: unknown): DbError | null =>
  typeof error === 'object' && error !== null ? (error as DbError) : null

/** Erro do Postgres 23503: o registro ainda é usado por outro (ex.: conta com lançamentos). */
export function isForeignKeyViolation(error: unknown): boolean {
  return asDbError(error)?.code === '23503'
}

/** O lançamento está numa fatura já paga e não pode ser alterado nem excluído. */
export function isPaidInvoiceError(error: unknown): boolean {
  const e = asDbError(error)
  return e?.code === '23514' && e.hint === 'paid_invoice'
}
