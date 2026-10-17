// Captura telas do app com dados de demonstração (sintéticos) para revisão visual.
// Nada é enviado ao Supabase: todas as chamadas são interceptadas e respondidas localmente.
// Uso: com `npm run dev` rodando, `node scripts/capture-screens.mjs [saida]`.
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'

const OUT = process.argv[2] ?? '.impeccable/review'
const BASE = 'http://localhost:5173'
mkdirSync(OUT, { recursive: true })

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const USER_ID = '00000000-0000-4000-8000-000000000001'

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(Math.max(1, Math.min(28, now.getDate() - d)))}`

const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'demo@exemplo.test', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' }
const session = {
  access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 3600 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user,
}
let profile = { id: USER_ID, name: 'Ana Souza', locale: 'pt-BR', currency: 'BRL', theme: 'light', onboarded_at: '2026-10-01T00:00:00Z', created_at: '', updated_at: '' }

const cat = (id, kind, key, icon, color, position) => ({ id, user_id: null, kind, name: null, i18n_key: key, icon, color, position, archived: false, created_at: '', updated_at: '' })
const categories = [
  cat('c-food', 'expense', 'food', 'utensils', '#f97316', 1),
  cat('c-groc', 'expense', 'groceries', 'shopping-cart', '#22c55e', 2),
  cat('c-tran', 'expense', 'transport', 'car', '#3b82f6', 3),
  cat('c-home', 'expense', 'housing', 'home', '#a855f7', 4),
  cat('c-util', 'expense', 'utilities', 'lightbulb', '#eab308', 5),
  cat('c-heal', 'expense', 'health', 'heart-pulse', '#ef4444', 6),
  cat('c-leis', 'expense', 'leisure', 'party-popper', '#ec4899', 8),
  cat('c-subs', 'expense', 'subscriptions', 'repeat', '#8b5cf6', 10),
  cat('c-sal', 'income', 'salary', 'briefcase', '#16a34a', 1),
  cat('c-free', 'income', 'freelance', 'laptop', '#0d9488', 2),
  { id: 'c-cafe', user_id: USER_ID, kind: 'expense', name: 'Café', i18n_key: null, icon: 'coffee', color: '#a16207', position: 100, archived: false, created_at: '', updated_at: '' },
]
const acc = (id, name, type, currency, initial, balance) => ({ id, user_id: USER_ID, name, type, currency, initial_balance: initial, archived: false, created_at: '', updated_at: '', _balance: balance })
const accounts = [
  acc('a-nu', 'Nubank', 'checking', 'BRL', 250000, 842390),
  acc('a-cash', 'Carteira', 'cash', 'BRL', 20000, 13450),
  acc('a-save', 'Reserva', 'savings', 'BRL', 1500000, 1520000),
  acc('a-eur', 'Conta em Lisboa', 'checking', 'EUR', 120000, 98760),
]
let n = 0
const tx = (d, kind, amount, category_id, account_id, description = '', currency = 'BRL', card_id = null, installments_count = 1) => ({
  id: `t${++n}`, user_id: USER_ID, kind, amount, currency, date: day(d), category_id, description, account_id, card_id, installments_count, group_id: null, recurring_id: null, created_at: `2026-10-0${n % 9}T10:00:00Z`, updated_at: '',
})
const transactions = [
  tx(0, 'expense', 3850, 'c-food', 'a-nu', 'Almoço com a equipe'),
  tx(0, 'expense', 1290, 'c-cafe', 'a-cash'),
  { ...tx(1, 'expense', 21437, 'c-groc', 'a-nu', 'Mercado do mês'), group_id: 'g-casa' },
  tx(1, 'expense', 2390, 'c-tran', 'a-nu', 'Uber'),
  tx(2, 'income', 650000, 'c-sal', 'a-nu', 'Salário'),
  tx(3, 'expense', 180000, 'c-home', 'a-nu', 'Aluguel'),
  tx(3, 'expense', 3990, 'c-subs', 'a-nu', 'Streaming'),
  tx(4, 'expense', 15600, 'c-util', 'a-nu', 'Conta de luz'),
  tx(5, 'expense', 8900, 'c-heal', 'a-nu', 'Farmácia'),
  tx(6, 'expense', 12000, 'c-leis', 'a-cash', 'Cinema e jantar'),
  tx(6, 'income', 120000, 'c-free', 'a-nu', 'Projeto freelance'),
  tx(7, 'expense', 2450, 'c-food', 'a-eur', 'Pastéis de Belém', 'EUR'),
  tx(0, 'expense', 120000, 'c-util', null, 'Notebook', 'BRL', 'k-nu', 6),
  tx(1, 'expense', 8450, 'c-leis', null, 'Ingressos', 'BRL', 'k-iti', 1),
]
// Entradas de competência do mês: lançamento em conta inteiro ou a parcela do mês no cartão.
const monthEntries = transactions.map((t) => ({
  month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, entry_id: `e-${t.id}`, transaction_id: t.id, user_id: USER_ID, kind: t.kind,
  amount: t.installments_count > 1 ? Math.floor(t.amount / t.installments_count) : t.amount, currency: t.currency, date: t.date,
  purchase_date: t.date, category_id: t.category_id, description: t.description, account_id: t.account_id, card_id: t.card_id,
  installment_number: 1, installments_count: t.installments_count, total_amount: t.amount, recurring_id: t.recurring_id, group_id: t.group_id, created_at: t.created_at,
}))

// Orçamentos pessoais em BRL; gasto do mês (monthEntries): Lazer 204,50 (passou), Moradia 1.800 (90%, perto),
// Contas 356 (71%), Mercado 214,37 (27%), Alimentação 38,50 (6%).
const budget = (id, category_id, amount) => ({ id, user_id: USER_ID, group_id: null, category_id, amount, currency: 'BRL', created_at: '2026-10-01T00:00:00Z', updated_at: '' })
const budgets = [
  budget('b1', 'c-leis', 18000),
  budget('b2', 'c-home', 200000),
  budget('b3', 'c-util', 50000),
  budget('b4', 'c-groc', 80000),
  budget('b5', 'c-food', 60000),
]

// Orçamentos do grupo Casa (gasto do mês nas groupEntries): Moradia 1.800 de 2.000 (90%, perto),
// Contas 475,90 de 400 (passou), Mercado 278,37 de 1.000 (27%).
const groupBudget = (id, category_id, amount) => ({ ...budget(id, category_id, amount), group_id: 'g-casa' })
const groupBudgets = [
  groupBudget('gb1', 'c-home', 200000),
  groupBudget('gb2', 'c-util', 40000),
  groupBudget('gb3', 'c-groc', 100000),
]

// Metas: uma atingida, uma com prazo vencido, uma sem prazo e uma arquivada.
const goal = (id, name, target_amount, saved, deadline, icon, color, archived = false) => ({
  id, user_id: USER_ID, name, target_amount, currency: 'BRL', deadline, icon, color, archived,
  created_at: '2026-01-01T00:00:00Z', updated_at: '', saved, contributions: 3, last_contribution: day(2),
})
const goals = [
  goal('go1', 'Reserva de emergência', 1000000, 1025000, `${now.getFullYear()}-12-31`, 'umbrella', '#10b981'),
  goal('go2', 'Viagem para o Chile', 800000, 512000, `${now.getFullYear()}-01-31`, 'plane', '#3b82f6'),
  goal('go3', 'Notebook novo', 650000, 147500, null, 'laptop', '#6366f1'),
  goal('go4', 'Curso de inglês', 300000, 90000, null, 'graduation-cap', '#f97316', true),
]
const goalContributions = [
  { id: 'gc1', user_id: USER_ID, goal_id: 'go2', amount: 200000, date: day(2), note: 'Bônus', created_at: '' },
  { id: 'gc2', user_id: USER_ID, goal_id: 'go2', amount: -38000, date: day(9), note: 'Passagem de ônibus', created_at: '' },
  { id: 'gc3', user_id: USER_ID, goal_id: 'go2', amount: 350000, date: day(20), note: '', created_at: '' },
]

const card = (id, name, color, limit, closing, due, used) => ({ id, user_id: USER_ID, name, limit_amount: limit, closing_day: closing, due_day: due, currency: 'BRL', color, archived: false, created_at: '2026-10-0' + (closing % 9 + 1) + 'T10:00:00Z', updated_at: '', _used: used })
const cards = [
  card('k-nu', 'Nubank Ultravioleta', '#5b3df5', 800000, 5, 12, 215000),
  card('k-iti', 'Itaú Click', '#eab308', 350000, 20, 27, 90000),
  card('k-inter', 'Inter Black', '#f97316', 500000, 10, 17, 0),
  card('k-c6', 'C6 Carbon', '#64748b', 1200000, 25, 5, 640000),
]

const ym = (delta) => { const d = new Date(now.getFullYear(), now.getMonth() + delta, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const inv = (id, delta, total, items, paid) => ({
  id, card_id: 'k-nu', reference_month: `${ym(delta)}-01`, closing_date: `${ym(delta)}-05`, due_date: `${ym(delta)}-12`,
  paid_at: paid ? `${ym(delta)}-12T12:00:00Z` : null, payment_account_id: paid ? 'a-nu' : null, payment_amount: paid ? total : null,
  currency: 'BRL', total, items,
})
const invoices = [inv('i1', -3, 184200, 6, true), inv('i2', -2, 96750, 4, false), inv('i3', -1, 152300, 7, false), inv('i4', 0, 215000, 5, false), inv('i5', 1, 48900, 2, false)]
const installments = [
  { id: 'n1', number: 3, amount: 33333, transaction: { id: 't3', description: 'Notebook', category_id: 'c-util', installments_count: 6, date: day(40), amount: 200000 } },
  { id: 'n2', number: 1, amount: 21437, transaction: { id: 't3', description: 'Mercado do mês', category_id: 'c-groc', installments_count: 1, date: day(2), amount: 21437 } },
  { id: 'n3', number: 1, amount: 3990, transaction: { id: 't7', description: 'Streaming', category_id: 'c-subs', installments_count: 1, date: day(3), amount: 3990 } },
  { id: 'n4', number: 2, amount: 12000, transaction: { id: 't10', description: 'Cinema e jantar', category_id: 'c-leis', installments_count: 3, date: day(20), amount: 36000 } },
]

const rec = (id, kind, amount, category_id, description, frequency, start, next, extra = {}) => ({
  id, user_id: USER_ID, kind, amount, currency: 'BRL', category_id, description, account_id: 'a-nu', card_id: null,
  frequency, start_date: start, end_date: null, next_date: next, paused: false, created_at: '', updated_at: '', ...extra,
})
const recurring = [
  rec('r1', 'expense', 180000, 'c-home', 'Aluguel', 'monthly', '2026-01-05', `${ym(1)}-05`),
  rec('r2', 'income', 650000, 'c-sal', 'Salário', 'monthly', '2026-01-28', `${ym(0)}-28`),
  rec('r3', 'expense', 3990, 'c-subs', 'Streaming', 'weekly', '2026-09-14', day(-3)),
  rec('r4', 'expense', 29900, 'c-heal', 'Academia', 'monthly', '2026-02-10', `${ym(0)}-10`, { paused: true }),
]

const groups = [
  { id: 'g-casa', name: 'Casa', currency: 'BRL', icon: 'home', role: 'admin', members: 3, created_at: '2026-10-01T00:00:00Z' },
  { id: 'g-lis', name: 'Viagem Lisboa', currency: 'EUR', icon: 'plane', role: 'member', members: 4, created_at: '2026-10-02T00:00:00Z' },
]

const BRUNO = '00000000-0000-4000-8000-000000000002'
const CARLA = '00000000-0000-4000-8000-000000000003'
const groupMembers = [
  { user_id: USER_ID, name: 'Ana Souza', role: 'admin', joined_at: '2026-10-01T00:00:00Z', left_at: null },
  { user_id: BRUNO, name: 'Bruno Lima', role: 'member', joined_at: '2026-10-02T00:00:00Z', left_at: null },
  { user_id: CARLA, name: 'Carla Dias', role: 'member', joined_at: '2026-10-02T00:00:00Z', left_at: day(2) + 'T12:00:00Z' },
]
let gn = 0
const gEntry = (user_id, d, amount, catId, description = '', extra = {}) => {
  const c = categories.find((x) => x.id === catId)
  gn += 1
  return {
    entry_id: `ge${gn}`, transaction_id: user_id === USER_ID ? `t${gn}` : `x${gn}`, user_id, kind: c.kind, amount, currency: 'BRL', date: day(d),
    category_id: c.id, category_name: c.name, category_key: c.i18n_key, category_icon: c.icon, category_color: c.color, description,
    is_card: false, installment_number: 1, installments_count: 1, created_at: `2026-10-0${gn % 9}T10:00:00Z`, ...extra,
  }
}
const groupEntries = [
  gEntry(USER_ID, 0, 21437, 'c-groc', 'Mercado do mês'),
  gEntry(BRUNO, 0, 15600, 'c-util', 'Conta de luz'),
  gEntry(USER_ID, 1, 20000, 'c-util', 'Geladeira nova', { is_card: true, installment_number: 2, installments_count: 10 }),
  gEntry(BRUNO, 1, 9800, 'c-food', 'Pizza de sexta'),
  gEntry(CARLA, 3, 6400, 'c-groc', 'Feira'),
  gEntry(USER_ID, 3, 180000, 'c-home', 'Aluguel'),
  gEntry(BRUNO, 4, 11990, 'c-util', 'Internet', { is_card: true }),
  gEntry(USER_ID, 5, 1290, 'c-cafe', ''),
  gEntry(BRUNO, 6, 4500, 'c-tran', 'Uber da feira'),
]
const groupInvites = [
  { id: 'gi1', group_id: 'g-casa', token: 'k3f9Qx2LmP7aZt0R', expires_at: new Date(Date.now() + 6 * 864e5).toISOString(), revoked_at: null, created_at: new Date(Date.now() - 864e5).toISOString() },
]

const invitePreview = { group_id: 'g-rep', name: 'República da Vila', icon: 'users', currency: 'BRL', members: 5, expires_at: new Date(Date.now() + 5 * 864e5).toISOString(), status: 'valid' }

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function mock(page) {
  await page.route(`https://${ref}.supabase.co/**`, (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    if (path.startsWith('/auth/v1/user')) return json(route, user)
    if (path === '/rest/v1/profiles') return json(route, single ? profile : [profile])
    if (path === '/rest/v1/accounts') return json(route, accounts.map(({ _balance, ...a }) => a))
    if (path === '/rest/v1/account_balances') return json(route, accounts.map((a) => ({ account_id: a.id, balance: a._balance })))
    if (path === '/rest/v1/categories') return json(route, categories)
    if (path === '/rest/v1/month_entries') return json(route, monthEntries)
    if (path === '/rest/v1/transactions') {
      const id = url.searchParams.get('id')
      if (id) return json(route, single ? transactions.find((t) => `eq.${t.id}` === id) : [])
      return json(route, transactions)
    }
    if (path === '/rest/v1/cards') return json(route, cards.map(({ _used, ...c }) => c))
    if (path === '/rest/v1/card_limits') return json(route, cards.map((c) => ({ card_id: c.id, used: c._used, available: c.limit_amount - c._used })))
    if (path === '/rest/v1/invoice_summaries') {
      const cid = url.searchParams.get('card_id')
      return json(route, cid ? invoices.filter((i) => `eq.${i.card_id}` === cid) : invoices.filter((i) => !i.paid_at))
    }
    if (path === '/rest/v1/rpc/my_groups') return json(route, groups)
    if (path === '/rest/v1/rpc/group_member_list') return json(route, groupMembers)
    if (path === '/rest/v1/rpc/group_month_entries') return json(route, groupEntries)
    if (path === '/rest/v1/group_invites') return json(route, groupInvites)
    if (path === '/rest/v1/rpc/group_invite_preview') return json(route, [invitePreview])
    if (path === '/rest/v1/recurring') return json(route, recurring)
    if (path === '/rest/v1/budgets') {
      if (url.searchParams.get('group_id') === 'eq.g-casa') return json(route, groupBudgets)
      return json(route, url.searchParams.get('user_id') ? budgets : [])
    }
    if (path === '/rest/v1/installments') return json(route, installments)
    if (path === '/rest/v1/goal_progress') return json(route, goals)
    if (path === '/rest/v1/goal_contributions') {
      const gid = url.searchParams.get('goal_id')
      return json(route, goalContributions.filter((c) => `eq.${c.goal_id}` === gid))
    }
    return json(route, [])
  })
}

const shots = [
  ['home', '/'], ['transactions', '/transactions'], ['new', '/new'], ['accounts', '/accounts'],
  ['cards', '/cards'], ['card-detail', '/cards/k-nu'], ['categories', '/categories'], ['recurring', '/recurring'], ['budgets', '/budgets'], ['goals', '/goals'], ['groups', '/groups'], ['group', '/groups/g-casa'], ['join', '/join/tok-demo'], ['settings', '/more'],
]
const viewports = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]
const themes = (process.env.THEMES ?? 'light').split(',')

const browser = await chromium.launch()
for (const theme of themes) {
  profile = { ...profile, theme }
  for (const [vp, size] of viewports) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: 'pt-BR', colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' })
    await context.addInitScript(([key, value, th]) => {
      localStorage.setItem(key, value)
      localStorage.setItem('theme', th)
      localStorage.setItem('install-dismissed', '1')
    }, [`sb-${ref}-auth-token`, JSON.stringify(session), theme])
    const page = await context.newPage()
    await mock(page)
    for (const [name, path] of shots) {
      await page.goto(BASE + path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(400)
      const suffix = theme === 'light' ? '' : `-${theme}`
      await page.screenshot({ path: `${OUT}/${vp}-${name}${suffix}.png`, fullPage: true })
    }
    // Tela de login (visitante)
    const guest = await browser.newContext({ viewport: size, locale: 'pt-BR', colorScheme: theme === 'dark' ? 'dark' : 'light' })
    const gp = await guest.newPage()
    await gp.goto(BASE + '/login')
    await gp.waitForLoadState('networkidle')
    await gp.screenshot({ path: `${OUT}/${vp}-login${theme === 'light' ? '' : `-${theme}`}.png`, fullPage: true })
    await guest.close()
    await context.close()
  }
}
await browser.close()
console.log('screens written to', OUT)
