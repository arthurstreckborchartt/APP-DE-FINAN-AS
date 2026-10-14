import { isRpcHint } from '../../lib/db-errors'

type T = (key: string) => string

/** Nome de um membro na tela: "Você" para o próprio usuário; texto padrão quando está vazio. */
export function memberDisplayName(member: { user_id: string; name: string }, myId: string | undefined, t: T): string {
  if (myId && member.user_id === myId) return t('groups.you')
  const name = member.name.trim()
  return name || t('groups.unnamed')
}

/**
 * Divide uma frase traduzida em volta de um marcador, para encaixar um componente (ex.: `Amount`)
 * no lugar do valor sem nunca formatar o dinheiro como texto.
 */
export function splitAtSlot(text: string, slot: string): [string, string] {
  const i = text.indexOf(slot)
  if (i < 0) return [text, '']
  return [text.slice(0, i), text.slice(i + slot.length)]
}

const HINTS: [hint: string, key: string][] = [
  ['not_admin', 'groups.notAdmin'],
  ['admin_must_transfer', 'groups.adminMustTransfer'],
  ['not_member', 'groups.notMember'],
]

/** Chave de tradução da mensagem para um erro das ações do grupo. */
export function groupErrorKey(error: unknown): string {
  for (const [hint, key] of HINTS) if (isRpcHint(error, hint)) return key
  // O RLS filtra em silêncio: 0 linhas alteradas (`group_not_changed`) quer dizer que não era admin.
  if (error instanceof Error && error.message === 'group_not_changed') return 'groups.notAdmin'
  return 'common.errorGeneric'
}
