import { useState } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import type { CurrencyCode } from '../../lib/money'
import { GroupPicker } from './GroupPicker'
import type { Group } from './types'

const state = vi.hoisted(() => ({ groups: undefined as unknown }))

vi.mock('./api', () => ({ useMyGroups: () => ({ data: state.groups }) }))

const group = (id: string, name: string, currency: CurrencyCode): Group => ({
  id, name, currency, icon: 'home', role: 'member', members: 2, created_at: '',
})
const casa = group('g-casa', 'Casa', 'BRL')
const viagem = group('g-lis', 'Viagem Lisboa', 'EUR')

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts)

function Harness({ initial, currency, onChange }: { initial: string | null; currency: CurrencyCode; onChange?: (v: string | null) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <GroupPicker value={value} currency={currency} onChange={(v) => { setValue(v); onChange?.(v) }} />
      <output data-testid="value">{value ?? 'none'}</output>
    </>
  )
}

describe('GroupPicker', () => {
  beforeEach(() => {
    state.groups = [casa, viagem]
  })

  test('oculto sem grupos e sem grupo marcado', () => {
    state.groups = []
    const { container } = render(<Harness initial={null} currency="BRL" />)
    expect(container.querySelector('fieldset')).toBeNull()
  })

  test('grupo de outra moeda fica desabilitado e mostra o aviso com a moeda da origem', () => {
    render(<Harness initial={null} currency="BRL" />)
    expect(screen.getByRole('radio', { name: 'Casa' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Viagem Lisboa' })).toBeDisabled()
    expect(screen.getByText(t('groups.groupCurrencyHint', { currency: 'BRL' }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Casa' }))
    expect(screen.getByTestId('value')).toHaveTextContent('g-casa')
  })

  test('sem grupo de outra moeda não mostra o aviso', () => {
    state.groups = [casa]
    render(<Harness initial={null} currency="BRL" />)
    expect(screen.queryByText(t('groups.groupCurrencyHint', { currency: 'BRL' }))).not.toBeInTheDocument()
  })

  test('trocar a origem para outra moeda limpa a escolha', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Harness initial="g-casa" currency="BRL" onChange={onChange} />)
    expect(screen.getByRole('radio', { name: 'Casa' })).toBeChecked()
    expect(onChange).not.toHaveBeenCalled()
    rerender(<Harness initial="g-casa" currency="EUR" onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByTestId('value')).toHaveTextContent('none')
    expect(screen.getByRole('radio', { name: t('groups.none') })).toBeChecked()
  })

  test('grupo que saiu da lista aparece como "Grupo anterior" e "Nenhum" o remove', () => {
    render(<Harness initial="g-antigo" currency="BRL" />)
    expect(screen.getByRole('radio', { name: t('groups.formerGroup') })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: t('groups.none') }))
    expect(screen.getByTestId('value')).toHaveTextContent('none')
    expect(screen.queryByRole('radio', { name: t('groups.formerGroup') })).not.toBeInTheDocument()
  })

  test('mostra o grupo anterior mesmo sem nenhum grupo na lista', () => {
    state.groups = []
    render(<Harness initial="g-antigo" currency="BRL" />)
    expect(screen.getByRole('radio', { name: t('groups.formerGroup') })).toBeChecked()
  })
})
