import { describe, expect, it } from 'vitest'
import { groupErrorKey, groupSaveErrorKey, joinErrorKey, memberDisplayName, splitAtSlot } from './display'

const t = (key: string) => `[${key}]`

describe('memberDisplayName', () => {
  it('usa "Você" para o próprio usuário', () => {
    expect(memberDisplayName({ user_id: 'u1', name: 'Ana' }, 'u1', t)).toBe('[groups.you]')
  })
  it('usa o nome dos outros, sem espaços nas pontas', () => {
    expect(memberDisplayName({ user_id: 'u2', name: '  Bruno ' }, 'u1', t)).toBe('Bruno')
  })
  it('usa o texto padrão quando o nome está vazio', () => {
    expect(memberDisplayName({ user_id: 'u2', name: '   ' }, 'u1', t)).toBe('[groups.unnamed]')
    expect(memberDisplayName({ user_id: 'u2', name: '' }, undefined, t)).toBe('[groups.unnamed]')
  })
})

describe('splitAtSlot', () => {
  it('divide em volta do marcador', () => {
    expect(splitAtSlot('Sua parte: @@ (40%)', '@@')).toEqual(['Sua parte: ', ' (40%)'])
  })
  it('sem marcador devolve o texto inteiro', () => {
    expect(splitAtSlot('Sua parte', '@@')).toEqual(['Sua parte', ''])
  })
})

describe('groupErrorKey', () => {
  it('mapeia os hints conhecidos', () => {
    expect(groupErrorKey({ hint: 'not_admin' })).toBe('groups.notAdmin')
    expect(groupErrorKey({ hint: 'admin_must_transfer' })).toBe('groups.adminMustTransfer')
    expect(groupErrorKey({ hint: 'not_member' })).toBe('groups.notMember')
  })
  it('0 linhas alteradas vira "só o administrador"', () => {
    expect(groupErrorKey(new Error('group_not_changed'))).toBe('groups.notAdmin')
  })
  it('qualquer outro erro é genérico', () => {
    expect(groupErrorKey(new Error('boom'))).toBe('common.errorGeneric')
    expect(groupErrorKey(null)).toBe('common.errorGeneric')
  })
})

describe('joinErrorKey', () => {
  it('traduz os hints de join_group', () => {
    expect(joinErrorKey({ hint: 'invite_invalid' })).toBe('groups.join.invalid')
    expect(joinErrorKey({ hint: 'invite_expired' })).toBe('groups.join.expired')
    expect(joinErrorKey({ hint: 'group_full' })).toBe('groups.join.full')
    expect(joinErrorKey({ hint: 'removed_from_group' })).toBe('groups.join.removed')
    expect(joinErrorKey(new Error('boom'))).toBe('common.errorGeneric')
  })
})

describe('groupSaveErrorKey', () => {
  it('traduz os hints de grupo ao salvar e ignora os demais', () => {
    expect(groupSaveErrorKey({ hint: 'not_group_member' })).toBe('groups.notMember')
    expect(groupSaveErrorKey({ hint: 'group_currency' })).toBe('groups.groupCurrency')
    expect(groupSaveErrorKey({ hint: 'paid_invoice' })).toBeNull()
  })
})
