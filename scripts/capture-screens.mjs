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
  id: `t${++n}`, user_id: USER_ID, kind, amount, currency, date: day(d), category_id, description, account_id, card_id, installments_count, created_at: `2026-10-0${n % 9}T10:00:00Z`, updated_at: '',
})
const transactions = [
  tx(0, 'expense', 3850, 'c-food', 'a-nu', 'Almoço com a equipe'),
  tx(0, 'expense', 1290, 'c-cafe', 'a-cash'),
  tx(1, 'expense', 21437, 'c-groc', 'a-nu', 'Mercado do mês'),
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
  installment_number: 1, installments_count: t.installments_count, total_amount: t.amount, created_at: t.created_at,
}))

const card = (id, name, color, limit, closing, due, used) => ({ id, user_id: USER_ID, name, limit_amount: limit, closing_day: closing, due_day: due, currency: 'BRL', color, archived: false, created_at: '2026-10-0' + (closing % 9 + 1) + 'T10:00:00Z', updated_at: '', _used: used })
const cards = [
  card('k-nu', 'Nubank Ultravioleta', '#5b3df5', 800000, 5, 12, 215000),
  card('k-iti', 'Itaú Click', '#eab308', 350000, 20, 27, 90000),
  card('k-inter', 'Inter Black', '#f97316', 500000, 10, 17, 0),
  card('k-c6', 'C6 Carbon', '#64748b', 1200000, 25, 5, 640000),
]

const ym = (delta) => { const d = new Date(now.getFullYear(), now.getMonth() + delta, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const inv = (id, delta, total, items, paid) => ({
  id, card_id: 'k-nu', reference_month: ym(delta), closing_date: `${ym(delta)}-05`, due_date: `${ym(delta)}-12`,
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
    if (path === '/rest/v1/installments') return json(route, installments)
    return json(route, [])
  })
}

const shots = [
  ['home', '/'], ['transactions', '/transactions'], ['new', '/new'], ['accounts', '/accounts'],
  ['cards', '/cards'], ['card-detail', '/cards/k-nu'], ['categories', '/categories'], ['settings', '/more'],
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
