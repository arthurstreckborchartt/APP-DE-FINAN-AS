import { describe, expect, test } from 'vitest'
import { closingDateOf, firstUnpaidInvoiceMonth, dueDateOf, installmentSchedule, invoiceMonthFor, invoiceStatus, splitInstallments } from './invoice'

describe('fatura da compra', () => {
  test('antes do fechamento: fatura do mesmo mês', () => expect(invoiceMonthFor('2026-03-05', 10)).toBe('2026-03'))
  test('no dia do fechamento: próxima fatura', () => expect(invoiceMonthFor('2026-03-10', 10)).toBe('2026-04'))
  test('virada de ano', () => expect(invoiceMonthFor('2026-12-20', 10)).toBe('2027-01'))
})

describe('datas da fatura', () => {
  test('fechamento', () => expect(closingDateOf('2026-03', 10)).toBe('2026-03-10'))
  test('vencimento depois do fechamento: mesmo mês', () => expect(dueDateOf('2026-03', 10, 17)).toBe('2026-03-17'))
  test('vencimento antes do fechamento: mês seguinte', () => expect(dueDateOf('2026-04', 25, 5)).toBe('2026-05-05'))
  test('vencimento em dezembro vira janeiro', () => expect(dueDateOf('2026-12', 25, 5)).toBe('2027-01-05'))
})

describe('parcelas', () => {
  test('divide com o resto na primeira', () => expect(splitInstallments(1001, 2)).toEqual([501, 500]))
  test('exato', () => expect(splitInstallments(30000, 3)).toEqual([10000, 10000, 10000]))
  test('à vista', () => expect(splitInstallments(1234, 1)).toEqual([1234]))
  test('cronograma', () =>
    expect(installmentSchedule('2026-11-15', 1001, 3, 10)).toEqual([
      { number: 1, amount: 335, invoiceMonth: '2026-12', competenceMonth: '2026-11' },
      { number: 2, amount: 333, invoiceMonth: '2027-01', competenceMonth: '2026-12' },
      { number: 3, amount: 333, invoiceMonth: '2027-02', competenceMonth: '2027-01' },
    ]))
})

describe('status da fatura', () => {
  const inv = { paid_at: null, closing_date: '2026-03-10', due_date: '2026-03-17' }
  test('aberta', () => expect(invoiceStatus(inv, '2026-03-09')).toBe('open'))
  test('fechada no dia do fechamento', () => expect(invoiceStatus(inv, '2026-03-10')).toBe('closed'))
  test('fechada até o vencimento', () => expect(invoiceStatus(inv, '2026-03-17')).toBe('closed'))
  test('vencida', () => expect(invoiceStatus(inv, '2026-03-18')).toBe('overdue'))
  test('paga', () => expect(invoiceStatus({ ...inv, paid_at: '2026-03-15T10:00:00Z' }, '2026-04-01')).toBe('paid'))
})

test('firstUnpaidInvoiceMonth pula faturas pagas', () => {
  const inv = [
    { reference_month: '2026-11', paid_at: '2026-11-10' },
    { reference_month: '2026-12', paid_at: '2026-12-10' },
  ]
  expect(firstUnpaidInvoiceMonth('2026-10-20', 15, inv)).toBe('2027-01')
  expect(firstUnpaidInvoiceMonth('2026-10-05', 15, inv)).toBe('2026-10')
  expect(firstUnpaidInvoiceMonth('2026-10-20', 15, [])).toBe('2026-11')
})
