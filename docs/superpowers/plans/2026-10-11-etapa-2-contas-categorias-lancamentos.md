# Etapa 2 — Contas, Categorias e Lançamentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pessoa cadastra contas (carteira, banco…), usa categorias padrão ou próprias, lança receitas e despesas com teclado numérico grande, vê a lista do mês com filtros e busca, e o Início mostra saldos, resumo do mês e últimos lançamentos.

**Architecture:** Três tabelas novas no Supabase (`accounts`, `categories`, `transactions`) com RLS, gatilho de validação (conta e categoria do próprio usuário, tipo da categoria = tipo do lançamento, moeda herdada da conta) e a view `account_balances` (`security_invoker`). No frontend, uma pasta por domínio em `src/features/` com `types.ts`, `api.ts` (TanStack Query) e páginas; regras puras (valores, datas, filtros, padrões) em funções testadas com Vitest. Testes de RLS em SQL rodam contra o projeto vinculado dentro de uma transação desfeita no fim (`rollback`).

**Tech Stack:** igual à Etapa 1 (React 19, TS 7, Vite 8, Tailwind 4, React Router 8, TanStack Query 5, supabase-js 2, i18next, lucide-react, Vitest, Playwright) + Supabase CLI `db query --linked` para os testes SQL.

**Spec:** `docs/superpowers/specs/2026-10-10-app-financas-design.md` (seções 3.3, 3.4, 3.5, 3.7 parte "conta", 4 itens 1–3 e 7, 5, 6, 9.2)

## Global Constraints

- Tudo da Etapa 1 continua valendo: 4 idiomas (`pt-BR`, `pt-PT`, `en`, `es`) com paridade de chaves; nenhum texto de interface fixo no código; valores em **centavos inteiros**; moedas `BRL, EUR, USD, GBP, CHF, CAD, AUD, ARS, MXN`; RLS em toda tabela; só chave anon no frontend; commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; tsconfig com `verbatimModuleSyntax` (usar `import type`).
- Tipos de conta: `cash | checking | savings | other`.
- Tipo de lançamento/categoria: `income | expense`.
- Receitas e despesas desta etapa saem sempre de uma **conta** (cartão entra na Etapa 3).
- A moeda do lançamento é sempre a da conta (definida no banco, nunca enviada pelo cliente).
- A moeda de uma conta não pode ser alterada depois de criada.
- Conta ou categoria com lançamentos não pode ser excluída (FK `restrict`, código Postgres `23503`) — a interface oferece **arquivar**.
- Valor máximo de um lançamento: `99_999_999_999` centavos.
- Descrição: até 140 caracteres. Nome de conta: 1–60. Nome de categoria: 1–40.
- Datas trafegam como texto `YYYY-MM-DD` (data local, sem fuso).
- Testes SQL nunca deixam dados: tudo entre `begin;` e `rollback;`, usuários de teste com e-mail `@test.invalid`.
- Nenhum comando `supabase db push` é rodado pelos implementadores — só pelo controlador.

## Estrutura de arquivos

```
supabase/migrations/20261011000001_accounts_categories_transactions.sql
supabase/tests/01_profiles.sql
supabase/tests/02_finance.sql
scripts/test-db.mjs
src/lib/amount.ts / amount.test.ts            # teclado de valor, parse de texto, formato simples
src/lib/dates.ts / dates.test.ts              # mês, intervalo, rótulos de dia
src/lib/db-errors.ts / db-errors.test.ts      # isForeignKeyViolation
src/features/transactions/types.ts            # TransactionKind, Transaction, TransactionInput
src/features/transactions/api.ts
src/features/transactions/filters.ts / filters.test.ts
src/features/transactions/defaults.ts / defaults.test.ts
src/features/transactions/TransactionRow.tsx
src/features/transactions/TransactionFormPage.tsx
src/features/transactions/TransactionsPage.tsx
src/features/accounts/types.ts api.ts totals.ts totals.test.ts
src/features/accounts/accountTypes.ts         # ícones e rótulos por tipo
src/features/accounts/AccountForm.tsx AccountsPage.tsx
src/features/categories/types.ts api.ts label.ts label.test.ts icons.ts
src/features/categories/CategoryForm.tsx CategoriesPage.tsx
src/features/home/HomePage.tsx
src/features/onboarding/OnboardingPage.tsx    # ganha a etapa "primeira conta"
src/features/settings/SettingsPage.tsx        # ganha links para Contas e Categorias
src/components/ui/Sheet.tsx SegmentedControl.tsx EmptyState.tsx QueryError.tsx MonthSwitcher.tsx
src/components/ui/AmountKeypad.tsx / AmountKeypad.test.tsx
src/components/CategoryIcon.tsx
src/app/router.tsx                            # novas rotas
```

---

### Task 1: Banco de dados — contas, categorias, lançamentos + testes de RLS

**Files:**
- Create: `supabase/migrations/20261011000001_accounts_categories_transactions.sql`, `supabase/tests/01_profiles.sql`, `supabase/tests/02_finance.sql`, `scripts/test-db.mjs`
- Modify: `package.json` (script `test:db`)

**Interfaces:**
- Produces (tabelas/colunas usadas pelo frontend):
  - `accounts(id, user_id, name, type, currency, initial_balance, archived, created_at, updated_at)`; cliente insere `name, type, currency, initial_balance`; atualiza `name, type, initial_balance, archived`.
  - `categories(id, user_id|null, kind, name|null, i18n_key|null, icon, color, position, archived, created_at, updated_at)`; sistema = `user_id null` com `i18n_key`; cliente insere `kind, name, icon, color`; atualiza `name, icon, color, archived`.
  - `transactions(id, user_id, kind, amount, currency, date, category_id, description, account_id, created_at, updated_at)`; cliente insere/atualiza `kind, amount, date, category_id, description, account_id`.
  - view `account_balances(account_id, user_id, currency, balance)`.
  - Chaves i18n das categorias do sistema (`i18n_key`): `food, groceries, transport, housing, utilities, health, education, leisure, shopping, subscriptions, travel, pets, taxes, other_expense, salary, freelance, investments, gifts, other_income`.
  - Script `npm run test:db`.

- [ ] **Step 1: Migration**

`supabase/migrations/20261011000001_accounts_categories_transactions.sql`:

```sql
-- Etapa 2: contas, categorias e lançamentos

------------------------------------------------------------
-- Contas
------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type text not null check (type in ('cash', 'checking', 'savings', 'other')),
  currency char(3) not null
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  initial_balance bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id);

alter table public.accounts enable row level security;
create policy accounts_select_own on public.accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy accounts_insert_own on public.accounts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy accounts_update_own on public.accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy accounts_delete_own on public.accounts for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.accounts from anon, authenticated;
grant select, delete on public.accounts to authenticated;
grant insert (name, type, currency, initial_balance) on public.accounts to authenticated;
grant update (name, type, initial_balance, archived) on public.accounts to authenticated;

create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- Categorias (user_id nulo = categoria padrão do sistema)
------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text check (name is null or char_length(btrim(name)) between 1 and 40),
  i18n_key text,
  icon text not null check (icon ~ '^[a-z0-9-]{1,40}$'),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  position smallint not null default 100,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_label check (
    (user_id is null and i18n_key is not null and name is null)
    or (user_id is not null and name is not null and i18n_key is null)
  )
);
create index categories_user_idx on public.categories (user_id);

alter table public.categories enable row level security;
create policy categories_select on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy categories_insert_own on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy categories_update_own on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete_own on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.categories from anon, authenticated;
grant select, delete on public.categories to authenticated;
grant insert (kind, name, icon, color) on public.categories to authenticated;
grant update (name, icon, color, archived) on public.categories to authenticated;

create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- Categorias padrão (auth.uid() é nulo aqui, então user_id fica nulo)
insert into public.categories (user_id, kind, i18n_key, icon, color, position) values
  (null, 'expense', 'food',          'utensils',        '#f97316', 1),
  (null, 'expense', 'groceries',     'shopping-cart',   '#22c55e', 2),
  (null, 'expense', 'transport',     'car',             '#3b82f6', 3),
  (null, 'expense', 'housing',       'home',            '#a855f7', 4),
  (null, 'expense', 'utilities',     'lightbulb',       '#eab308', 5),
  (null, 'expense', 'health',        'heart-pulse',     '#ef4444', 6),
  (null, 'expense', 'education',     'graduation-cap',  '#06b6d4', 7),
  (null, 'expense', 'leisure',       'party-popper',    '#ec4899', 8),
  (null, 'expense', 'shopping',      'shopping-bag',    '#f43f5e', 9),
  (null, 'expense', 'subscriptions', 'repeat',          '#8b5cf6', 10),
  (null, 'expense', 'travel',        'plane',           '#0ea5e9', 11),
  (null, 'expense', 'pets',          'paw-print',       '#d97706', 12),
  (null, 'expense', 'taxes',         'landmark',        '#64748b', 13),
  (null, 'expense', 'other_expense', 'circle-ellipsis', '#94a3b8', 14),
  (null, 'income',  'salary',        'briefcase',       '#16a34a', 1),
  (null, 'income',  'freelance',     'laptop',          '#0d9488', 2),
  (null, 'income',  'investments',   'trending-up',     '#2563eb', 3),
  (null, 'income',  'gifts',         'gift',            '#db2777', 4),
  (null, 'income',  'other_income',  'circle-ellipsis', '#94a3b8', 5);

------------------------------------------------------------
-- Lançamentos
------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount bigint not null check (amount > 0 and amount <= 99999999999),
  currency char(3) not null,
  date date not null check (date between '2000-01-01' and '2100-12-31'),
  category_id uuid not null references public.categories (id) on delete restrict,
  description text not null default '' check (char_length(description) <= 140),
  account_id uuid not null references public.accounts (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions (user_id, date desc, created_at desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_category_idx on public.transactions (category_id);

alter table public.transactions enable row level security;
create policy transactions_select_own on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy transactions_insert_own on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy transactions_update_own on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transactions_delete_own on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.transactions from anon, authenticated;
grant select, delete on public.transactions to authenticated;
grant insert (kind, amount, date, category_id, description, account_id) on public.transactions to authenticated;
grant update (kind, amount, date, category_id, description, account_id) on public.transactions to authenticated;

-- Valida conta e categoria e copia a moeda da conta.
-- security invoker: as leituras respeitam o RLS de quem está lançando.
create function public.transactions_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acc_user uuid;
  acc_currency char(3);
  cat_user uuid;
  cat_kind text;
begin
  select a.user_id, a.currency into acc_user, acc_currency
    from public.accounts a where a.id = new.account_id;
  if acc_user is null or acc_user <> new.user_id then
    raise exception 'conta inválida' using errcode = '23514';
  end if;

  select c.user_id, c.kind into cat_user, cat_kind
    from public.categories c where c.id = new.category_id;
  if cat_kind is null or (cat_user is not null and cat_user <> new.user_id) then
    raise exception 'categoria inválida' using errcode = '23514';
  end if;
  if cat_kind <> new.kind then
    raise exception 'tipo da categoria diferente do lançamento' using errcode = '23514';
  end if;

  new.currency := acc_currency;
  return new;
end;
$$;
revoke execute on function public.transactions_validate() from public, anon, authenticated;

create trigger transactions_validate before insert or update on public.transactions
  for each row execute function public.transactions_validate();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- Saldo por conta
------------------------------------------------------------
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.currency,
  (a.initial_balance + coalesce(sum(case when t.kind = 'income' then t.amount else -t.amount end), 0))::bigint as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

revoke all on public.account_balances from anon, authenticated;
grant select on public.account_balances to authenticated;
```

- [ ] **Step 2: Testes SQL**

`supabase/tests/01_profiles.sql`:

```sql
-- RLS de perfis. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-profile-a@test.invalid', '{"name":"A","locale":"en"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'rls-profile-b@test.invalid', '{}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

do $$
declare
  n int;
  loc text;
  failed boolean := false;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: A vê % perfis', n; end if;

  select locale into loc from public.profiles;
  if loc <> 'en' then raise exception 'FAIL: locale do cadastro não aplicado (%)', loc; end if;

  update public.profiles set name = 'hack' where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A alterou o perfil de B'; end if;

  begin
    update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: created_at pode ser alterado'; end if;
end $$;

set local role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform 1 from public.profiles;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê profiles'; end if;
end $$;

select 'PASS' as result;
rollback;
```

`supabase/tests/02_finance.sql`:

```sql
-- RLS e regras de contas, categorias e lançamentos. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'rls-fin-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b2', 'rls-fin-b@test.invalid');

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;

set local role authenticated;

-- Usuário A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
do $$
declare
  acc uuid; cat uuid; sys_food uuid; sys_salary uuid; tx uuid;
  n int; bal bigint; cur text; failed boolean;
begin
  select id into sys_food from public.categories where i18n_key = 'food';
  select id into sys_salary from public.categories where i18n_key = 'salary';
  if sys_food is null or sys_salary is null then raise exception 'FAIL: categorias padrão invisíveis'; end if;

  select count(*) into n from public.categories where user_id is null;
  if n <> 19 then raise exception 'FAIL: esperado 19 categorias padrão, veio %', n; end if;

  insert into public.accounts (name, type, currency, initial_balance)
    values ('Carteira A', 'cash', 'EUR', 10000) returning id into acc;
  insert into public.categories (kind, name, icon, color)
    values ('expense', 'Café', 'coffee', '#f97316') returning id into cat;
  insert into ids values ('acc', acc), ('cat', cat);

  insert into public.transactions (kind, amount, date, category_id, account_id)
    values ('expense', 2500, current_date, sys_food, acc) returning id into tx;
  insert into public.transactions (kind, amount, date, category_id, account_id, description)
    values ('income', 5000, current_date, sys_salary, acc, 'pagamento');

  select currency into cur from public.transactions where id = tx;
  if cur <> 'EUR' then raise exception 'FAIL: moeda não veio da conta (%)', cur; end if;

  select balance into bal from public.account_balances where account_id = acc;
  if bal <> 12500 then raise exception 'FAIL: saldo % <> 12500', bal; end if;

  failed := false;
  begin
    insert into public.transactions (kind, amount, date, category_id, account_id)
      values ('income', 100, current_date, sys_food, acc);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: tipo de categoria diferente aceito'; end if;

  failed := false;
  begin
    update public.accounts set currency = 'BRL' where id = acc;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: moeda da conta alterável'; end if;

  failed := false;
  begin
    delete from public.accounts where id = acc;
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: conta com lançamentos excluída'; end if;

  update public.categories set name = 'hack' where id = sys_food;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: categoria padrão alterada'; end if;
end $$;

-- Usuário B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$
declare
  acc_a uuid; cat_a uuid; acc_b uuid; sys_food uuid; n int; failed boolean;
begin
  select v into acc_a from ids where k = 'acc';
  select v into cat_a from ids where k = 'cat';

  select count(*) into n from public.accounts;
  if n <> 0 then raise exception 'FAIL: B vê contas de A'; end if;
  select count(*) into n from public.transactions;
  if n <> 0 then raise exception 'FAIL: B vê lançamentos de A'; end if;
  select count(*) into n from public.account_balances;
  if n <> 0 then raise exception 'FAIL: B vê saldos de A'; end if;
  select count(*) into n from public.categories where user_id is not null;
  if n <> 0 then raise exception 'FAIL: B vê categorias de A'; end if;

  select id into sys_food from public.categories where i18n_key = 'food';

  failed := false;
  begin
    insert into public.transactions (kind, amount, date, category_id, account_id)
      values ('expense', 1, current_date, sys_food, acc_a);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: B lançou na conta de A'; end if;

  update public.accounts set name = 'x' where id = acc_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B alterou conta de A'; end if;

  insert into public.accounts (name, type, currency) values ('Conta B', 'checking', 'BRL') returning id into acc_b;
  failed := false;
  begin
    insert into public.transactions (kind, amount, date, category_id, account_id)
      values ('expense', 1, current_date, cat_a, acc_b);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: B usou categoria de A'; end if;
end $$;

set local role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform 1 from public.accounts;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê contas'; end if;
end $$;

select 'PASS' as result;
rollback;
```

- [ ] **Step 3: Script `scripts/test-db.mjs`**

```js
// Roda cada arquivo de supabase/tests contra o projeto vinculado.
// Cada arquivo abre uma transação e termina com rollback, então nada fica salvo.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const dir = 'supabase/tests'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
let failed = 0

for (const file of files) {
  try {
    const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', `${dir}/${file}`], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (/"result":\s*"PASS"/.test(out)) {
      console.log(`✓ ${file}`)
    } else {
      failed++
      console.error(`✗ ${file}\n${out}`)
    }
  } catch (err) {
    failed++
    console.error(`✗ ${file}\n${err.stdout ?? ''}${err.stderr ?? ''}`)
  }
}

process.exit(failed ? 1 : 0)
```

`package.json` → scripts: `"test:db": "node scripts/test-db.mjs"`.

- [ ] **Step 4: Rodar `npm test` e `npm run build`** (não mudam, mas devem continuar verdes) e commitar. **Não** rodar `db push` nem `test:db` — o controlador aplica a migration e roda `npm run test:db` depois da revisão.

```bash
git add supabase/migrations/20261011000001_accounts_categories_transactions.sql supabase/tests scripts/test-db.mjs package.json
git commit -m "feat(db): contas, categorias e lançamentos com RLS e testes SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Funções puras — valores, datas e erros do banco (TDD)

**Files:**
- Create: `src/lib/amount.ts`, `src/lib/amount.test.ts`, `src/lib/dates.ts`, `src/lib/dates.test.ts`, `src/lib/db-errors.ts`, `src/lib/db-errors.test.ts`

**Interfaces:**
- Produces:
  - `MAX_AMOUNT_CENTS = 99_999_999_999`; `appendDigit(cents: number, digit: number): number`; `removeDigit(cents: number): number`; `parseAmount(text: string): number | null`; `formatAmountPlain(cents: number, locale: string): string`
  - `todayISO(now?: Date): string`; `isMonth(v: string | null | undefined): v is string`; `monthOf(dateISO: string): string`; `monthRange(month: string): { start: string; end: string }`; `shiftMonth(month: string, delta: number): string`; `formatMonth(month: string, locale: string): string`; `formatDay(dateISO: string, locale: string): string`; `relativeDay(dateISO: string, today: string): 'today' | 'yesterday' | null`
  - `isForeignKeyViolation(error: unknown): boolean`

- [ ] **Step 1: Testes (falham)**

`src/lib/amount.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { appendDigit, formatAmountPlain, MAX_AMOUNT_CENTS, parseAmount, removeDigit } from './amount'

describe('teclado de valor', () => {
  test('digitar 1, 2, 3 vira 1,23', () => expect([1, 2, 3].reduce(appendDigit, 0)).toBe(123))
  test('apagar remove o último dígito', () => expect(removeDigit(123)).toBe(12))
  test('apagar em zero continua zero', () => expect(removeDigit(0)).toBe(0))
  test('não passa do máximo', () => expect(appendDigit(MAX_AMOUNT_CENTS, 9)).toBe(MAX_AMOUNT_CENTS))
})

describe('parseAmount', () => {
  test.each([
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['10', 1000],
    ['10,', 1000],
    [',5', 50],
    ['-50', -5000],
    ['  2 500,00 ', 250000],
    ['0', 0],
  ])('%s → %d', (text, cents) => expect(parseAmount(text)).toBe(cents))

  test.each([[''], ['abc'], ['1,2,3a'], ['-'], ['999999999999999']])('%s inválido', (text) =>
    expect(parseAmount(text)).toBeNull())
})

describe('formatAmountPlain', () => {
  test('pt-BR sem agrupamento', () => expect(formatAmountPlain(123456, 'pt-BR')).toBe('1234,56'))
  test('en', () => expect(formatAmountPlain(123456, 'en')).toBe('1234.56'))
  test('negativo', () => expect(formatAmountPlain(-500, 'en')).toBe('-5.00'))
})
```

`src/lib/dates.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { formatMonth, isMonth, monthOf, monthRange, relativeDay, shiftMonth, todayISO } from './dates'

describe('datas', () => {
  test('todayISO usa a data local', () => expect(todayISO(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05'))
  test('monthOf', () => expect(monthOf('2026-10-05')).toBe('2026-10'))
  test('isMonth', () => {
    expect(isMonth('2026-10')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('abc')).toBe(false)
    expect(isMonth(null)).toBe(false)
  })
  test('monthRange fevereiro comum', () => expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' }))
  test('monthRange fevereiro bissexto', () => expect(monthRange('2024-02').end).toBe('2024-02-29'))
  test('monthRange outubro', () => expect(monthRange('2026-10').end).toBe('2026-10-31'))
  test('shiftMonth volta o ano', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'))
  test('shiftMonth avança o ano', () => expect(shiftMonth('2026-12', 1)).toBe('2027-01'))
  test('formatMonth en', () => expect(formatMonth('2026-10', 'en')).toBe('October 2026'))
  test('relativeDay hoje', () => expect(relativeDay('2026-10-05', '2026-10-05')).toBe('today'))
  test('relativeDay ontem na virada do mês', () => expect(relativeDay('2026-09-30', '2026-10-01')).toBe('yesterday'))
  test('relativeDay outro dia', () => expect(relativeDay('2026-10-01', '2026-10-05')).toBeNull())
})
```

`src/lib/db-errors.test.ts`:

```ts
import { expect, test } from 'vitest'
import { isForeignKeyViolation } from './db-errors'

test('23503 é violação de chave estrangeira', () => expect(isForeignKeyViolation({ code: '23503' })).toBe(true))
test('outros códigos não são', () => expect(isForeignKeyViolation({ code: '23514' })).toBe(false))
test('valores não-objeto não são', () => {
  expect(isForeignKeyViolation(null)).toBe(false)
  expect(isForeignKeyViolation('23503')).toBe(false)
})
```

Run: `npm test` → FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar**

`src/lib/amount.ts`:

```ts
/** Maior valor aceito para um lançamento: 999.999.999,99. */
export const MAX_AMOUNT_CENTS = 99_999_999_999

/** Teclado de valor: cada dígito entra pela direita (1 → 0,01; 12 → 0,12; 123 → 1,23). */
export function appendDigit(cents: number, digit: number): number {
  const next = cents * 10 + digit
  return next > MAX_AMOUNT_CENTS ? cents : next
}

export function removeDigit(cents: number): number {
  return Math.floor(cents / 10)
}

/**
 * Converte texto digitado ("1.234,56", "1,234.56", "-50") em centavos.
 * O último separador seguido de 1 ou 2 dígitos é o decimal; os demais são de milhar.
 */
export function parseAmount(text: string): number | null {
  const s = text.replace(/[\s  ]/g, '')
  if (!s) return null
  const negative = s.startsWith('-')
  const body = negative ? s.slice(1) : s
  if (!body || !/^[0-9.,]+$/.test(body)) return null

  const lastSep = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'))
  let intPart = body
  let fracPart = ''
  if (lastSep !== -1 && body.length - lastSep - 1 <= 2) {
    intPart = body.slice(0, lastSep)
    fracPart = body.slice(lastSep + 1)
  }
  intPart = intPart.replace(/[.,]/g, '')
  if (!intPart && !fracPart) return null

  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null
  return negative ? -cents : cents
}

/** Valor com 2 casas e sem separador de milhar, para preencher campos de texto. */
export function formatAmountPlain(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100)
}
```

`src/lib/dates.ts`:

```ts
const pad = (n: number) => String(n).padStart(2, '0')

function parts(iso: string): number[] {
  return iso.split('-').map(Number)
}

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isMonth(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7)
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = parts(month)
  const lastDay = new Date(y, m, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${pad(lastDay)}` }
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = parts(month)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function formatMonth(month: string, locale: string): string {
  const [y, m] = parts(month)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export function formatDay(dateISO: string, locale: string): string {
  const [y, m, d] = parts(dateISO)
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}

export function relativeDay(dateISO: string, today: string): 'today' | 'yesterday' | null {
  if (dateISO === today) return 'today'
  const [y, m, d] = parts(today)
  return dateISO === todayISO(new Date(y, m - 1, d - 1)) ? 'yesterday' : null
}
```

`src/lib/db-errors.ts`:

```ts
/** Erro do Postgres 23503: o registro ainda é usado por outro (ex.: conta com lançamentos). */
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23503'
}
```

- [ ] **Step 3: `npm test` → PASS; `npm run build` → OK.** Se o ICU do Node formatar `formatMonth` diferente (ex.: maiúsculas), ajustar a expectativa ao formato real, nunca a implementação.

- [ ] **Step 4: Commit** — `feat: funções de valor, datas e erros do banco`.

---

### Task 3: Traduções da Etapa 2 (4 idiomas)

**Files:**
- Modify: `src/i18n/locales/pt-BR.json`, `pt-PT.json`, `en.json`, `es.json`

**Interfaces:**
- Produces: as chaves abaixo (mescladas às existentes; nenhuma chave existente removida).

- [ ] **Step 1: Mesclar em `pt-BR.json`** (blocos novos ou chaves novas dentro de blocos existentes):

```json
{
  "common": {
    "edit": "Editar",
    "delete": "Excluir",
    "confirmDelete": "Toque de novo para confirmar",
    "archive": "Arquivar",
    "unarchive": "Desarquivar",
    "archived": "Arquivada",
    "close": "Fechar",
    "skip": "Pular",
    "create": "Criar",
    "all": "Todos",
    "default": "Padrão"
  },
  "accounts": {
    "title": "Contas",
    "new": "Nova conta",
    "edit": "Editar conta",
    "name": "Nome da conta",
    "type": "Tipo",
    "currency": "Moeda",
    "currencyLocked": "A moeda não pode ser alterada depois que a conta é criada.",
    "initialBalance": "Saldo inicial",
    "invalidBalance": "Valor inválido. Use, por exemplo, 1.250,00.",
    "balance": "Saldo",
    "total": "Saldo total",
    "empty": "Nenhuma conta ainda",
    "emptyBody": "Crie uma conta para começar a registrar receitas e despesas.",
    "archivedSection": "Contas arquivadas",
    "deleteBlocked": "Esta conta tem lançamentos. Arquive-a em vez de excluir.",
    "types": {
      "cash": "Dinheiro",
      "checking": "Conta corrente",
      "savings": "Poupança",
      "other": "Outra"
    }
  },
  "categories": {
    "title": "Categorias",
    "new": "Nova categoria",
    "edit": "Editar categoria",
    "name": "Nome",
    "icon": "Ícone",
    "color": "Cor",
    "expense": "Despesas",
    "income": "Receitas",
    "systemHint": "Categorias padrão não podem ser editadas.",
    "archivedSection": "Categorias arquivadas",
    "deleteBlocked": "Esta categoria tem lançamentos. Arquive-a em vez de excluir.",
    "system": {
      "food": "Alimentação",
      "groceries": "Mercado",
      "transport": "Transporte",
      "housing": "Moradia",
      "utilities": "Contas da casa",
      "health": "Saúde",
      "education": "Educação",
      "leisure": "Lazer",
      "shopping": "Compras",
      "subscriptions": "Assinaturas",
      "travel": "Viagens",
      "pets": "Pets",
      "taxes": "Impostos e taxas",
      "other_expense": "Outras despesas",
      "salary": "Salário",
      "freelance": "Freelance",
      "investments": "Investimentos",
      "gifts": "Presentes",
      "other_income": "Outras receitas"
    }
  },
  "transactions": {
    "title": "Lançamentos",
    "new": "Novo lançamento",
    "edit": "Editar lançamento",
    "expense": "Despesa",
    "income": "Receita",
    "amount": "Valor",
    "category": "Categoria",
    "account": "Conta",
    "date": "Data",
    "description": "Descrição",
    "descriptionPlaceholder": "Ex.: almoço com a equipe",
    "save": "Salvar lançamento",
    "backspace": "Apagar dígito",
    "empty": "Nenhum lançamento neste mês",
    "emptyBody": "Toque em + para registrar o primeiro.",
    "noResults": "Nenhum lançamento encontrado com esses filtros.",
    "noAccounts": "Crie uma conta antes de registrar lançamentos.",
    "goToAccounts": "Criar conta",
    "income_total": "Entradas",
    "expense_total": "Saídas",
    "net_total": "Resultado",
    "allAccounts": "Todas as contas",
    "allCategories": "Todas as categorias",
    "search": "Buscar",
    "searchPlaceholder": "Buscar por descrição ou categoria",
    "previousMonth": "Mês anterior",
    "nextMonth": "Próximo mês",
    "today": "Hoje",
    "yesterday": "Ontem",
    "errors": {
      "amount": "Informe um valor maior que zero.",
      "category": "Escolha uma categoria.",
      "account": "Escolha uma conta."
    }
  },
  "home": {
    "greeting": "Olá, {{name}}!",
    "greetingNoName": "Olá!",
    "balance": "Saldo nas contas",
    "thisMonth": "Este mês",
    "recent": "Últimos lançamentos",
    "seeAll": "Ver todos"
  },
  "onboarding": {
    "stepPreferences": "Preferências",
    "stepAccount": "Primeira conta",
    "accountTitle": "Sua primeira conta",
    "accountSubtitle": "Onde fica o seu dinheiro? Pode ser a carteira ou o banco. Você pode criar outras depois.",
    "defaultAccountName": "Carteira"
  }
}
```

- [ ] **Step 2: Mesclar em `en.json`** as mesmas chaves:

```json
{
  "common": {
    "edit": "Edit", "delete": "Delete", "confirmDelete": "Tap again to confirm", "archive": "Archive",
    "unarchive": "Unarchive", "archived": "Archived", "close": "Close", "skip": "Skip", "create": "Create",
    "all": "All", "default": "Default"
  },
  "accounts": {
    "title": "Accounts", "new": "New account", "edit": "Edit account", "name": "Account name", "type": "Type",
    "currency": "Currency", "currencyLocked": "The currency can't be changed after the account is created.",
    "initialBalance": "Starting balance", "invalidBalance": "Invalid amount. Use, for example, 1,250.00.",
    "balance": "Balance", "total": "Total balance", "empty": "No accounts yet",
    "emptyBody": "Create an account to start recording income and expenses.",
    "archivedSection": "Archived accounts",
    "deleteBlocked": "This account has transactions. Archive it instead of deleting.",
    "types": { "cash": "Cash", "checking": "Checking account", "savings": "Savings", "other": "Other" }
  },
  "categories": {
    "title": "Categories", "new": "New category", "edit": "Edit category", "name": "Name", "icon": "Icon",
    "color": "Color", "expense": "Expenses", "income": "Income",
    "systemHint": "Default categories can't be edited.", "archivedSection": "Archived categories",
    "deleteBlocked": "This category has transactions. Archive it instead of deleting.",
    "system": {
      "food": "Food & dining", "groceries": "Groceries", "transport": "Transportation", "housing": "Housing",
      "utilities": "Bills & utilities", "health": "Health", "education": "Education", "leisure": "Entertainment",
      "shopping": "Shopping", "subscriptions": "Subscriptions", "travel": "Travel", "pets": "Pets",
      "taxes": "Taxes & fees", "other_expense": "Other expenses", "salary": "Salary", "freelance": "Freelance",
      "investments": "Investments", "gifts": "Gifts", "other_income": "Other income"
    }
  },
  "transactions": {
    "title": "Transactions", "new": "New transaction", "edit": "Edit transaction", "expense": "Expense",
    "income": "Income", "amount": "Amount", "category": "Category", "account": "Account", "date": "Date",
    "description": "Description", "descriptionPlaceholder": "E.g. team lunch", "save": "Save transaction",
    "backspace": "Delete digit", "empty": "No transactions this month", "emptyBody": "Tap + to record the first one.",
    "noResults": "No transactions match these filters.", "noAccounts": "Create an account before recording transactions.",
    "goToAccounts": "Create account", "income_total": "Income", "expense_total": "Expenses", "net_total": "Net",
    "allAccounts": "All accounts", "allCategories": "All categories", "search": "Search",
    "searchPlaceholder": "Search by description or category", "previousMonth": "Previous month",
    "nextMonth": "Next month", "today": "Today", "yesterday": "Yesterday",
    "errors": { "amount": "Enter an amount greater than zero.", "category": "Choose a category.", "account": "Choose an account." }
  },
  "home": {
    "greeting": "Hi, {{name}}!", "greetingNoName": "Hi!", "balance": "Account balance", "thisMonth": "This month",
    "recent": "Recent transactions", "seeAll": "See all"
  },
  "onboarding": {
    "stepPreferences": "Preferences", "stepAccount": "First account", "accountTitle": "Your first account",
    "accountSubtitle": "Where is your money? It can be your wallet or your bank. You can add more later.",
    "defaultAccountName": "Wallet"
  }
}
```

- [ ] **Step 3: Traduzir as mesmas chaves para `pt-PT.json` e `es.json`**, seguindo o padrão já usado nesses arquivos: pt-PT com vocabulário europeu e tratamento formal ("Guardar", "Movimentos", "ecrã", "Conta à ordem" para *checking*, "Poupança", "Toque novamente para confirmar", "Aceda", "o seu"); es com tratamento "tú" ("Cuenta corriente", "Ahorros", "Efectivo", "Movimientos", "Toca de nuevo para confirmar"). Em pt-PT, "Lançamentos" → "Movimentos" (consistente com `nav.transactions`); em es, "Movimientos". `{{name}}` deve existir em `home.greeting` nos 4.

- [ ] **Step 4: `npm test`** (o teste de paridade de chaves precisa passar) e **commit** — `feat(i18n): textos da etapa 2 em 4 idiomas`.

---

### Task 4: Camada de dados — tipos, API e regras de lançamentos (TDD nas regras)

**Files:**
- Create: `src/features/transactions/types.ts`, `api.ts`, `filters.ts`, `filters.test.ts`, `defaults.ts`, `defaults.test.ts`; `src/features/accounts/types.ts`, `api.ts`, `totals.ts`, `totals.test.ts`; `src/features/categories/types.ts`, `api.ts`, `label.ts`, `label.test.ts`

**Interfaces:**
- Consumes: `supabase`, `useAuth`, `monthRange` (Task 2), `CurrencyCode`
- Produces:
  - `type TransactionKind = 'income' | 'expense'`; `type Transaction = { id: string; user_id: string; kind: TransactionKind; amount: number; currency: CurrencyCode; date: string; category_id: string; description: string; account_id: string; created_at: string; updated_at: string }`; `type TransactionInput = Pick<Transaction, 'kind' | 'amount' | 'date' | 'category_id' | 'description' | 'account_id'>`
  - `useTransactions(month: string)`, `useRecentTransactions()`, `useTransaction(id: string | undefined)`, `useCreateTransaction()`, `useUpdateTransaction()` (mutation arg `{ id: string; input: TransactionInput }`), `useDeleteTransaction()` (arg `id: string`)
  - `type TransactionFilters = { kind?: TransactionKind; accountId?: string; categoryId?: string; search?: string }`; `filterTransactions(list, filters, labelOf: (categoryId: string) => string): Transaction[]`; `type DayGroup = { date: string; items: Transaction[] }`; `groupByDate(list): DayGroup[]`; `type CurrencySummary = { currency: string; income: number; expense: number; net: number }`; `summarizeByCurrency(list): CurrencySummary[]`
  - `mostFrequent(ids: string[]): string | undefined`; `pickDefaults(recent: Transaction[], kind: TransactionKind, activeAccountIds: string[], activeCategoryIds: string[]): { accountId: string | null; categoryId: string | null }`
  - `type AccountType = 'cash' | 'checking' | 'savings' | 'other'`; `ACCOUNT_TYPES: readonly AccountType[]`; `type Account = { id; user_id; name; type: AccountType; currency: CurrencyCode; initial_balance: number; archived: boolean; created_at; updated_at }` (strings); `type AccountWithBalance = Account & { balance: number }`; `type AccountInput = Pick<Account, 'name' | 'type' | 'currency' | 'initial_balance'>`; `type AccountPatch = Partial<Pick<Account, 'name' | 'type' | 'initial_balance' | 'archived'>>`
  - `useAccounts()` → `AccountWithBalance[]`; `useCreateAccount()` (arg `AccountInput`); `useUpdateAccount()` (arg `{ id: string; patch: AccountPatch }`); `useDeleteAccount()` (arg `id`)
  - `balancesByCurrency(accounts: AccountWithBalance[]): { currency: string; total: number }[]` (só não arquivadas)
  - `type Category = { id: string; user_id: string | null; kind: TransactionKind; name: string | null; i18n_key: string | null; icon: string; color: string; position: number; archived: boolean; created_at: string; updated_at: string }`; `type CategoryInput = { kind: TransactionKind; name: string; icon: string; color: string }`; `type CategoryPatch = Partial<Pick<Category, 'icon' | 'color' | 'archived'>> & { name?: string }`
  - `useCategories()` → `Category[]` ordenadas por `position`, depois `created_at`; `useCreateCategory()`, `useUpdateCategory()` (arg `{ id; patch }`), `useDeleteCategory()` (arg `id`)
  - `categoryLabel(cat: Pick<Category, 'name' | 'i18n_key'>, t: (key: string) => string): string`
  - Query keys: `['accounts', uid]`, `['categories', uid]`, `['transactions', uid, ...]`. Mutações de lançamentos invalidam `['transactions']` e `['accounts']`; de contas invalidam `['accounts']`; de categorias invalidam `['categories']`.

- [ ] **Step 1: Testes das regras (falham)**

`src/features/transactions/filters.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import type { Transaction } from './types'
import { filterTransactions, groupByDate, summarizeByCurrency } from './filters'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'id', user_id: 'u', kind: 'expense', amount: 100, currency: 'BRL', date: '2026-10-05',
    category_id: 'c1', description: '', account_id: 'a1', created_at: '', updated_at: '', ...p,
  }
}

const labels: Record<string, string> = { c1: 'Alimentação', c2: 'Salário' }
const labelOf = (id: string) => labels[id] ?? ''

describe('filterTransactions', () => {
  const list = [
    tx({ id: '1', description: 'Almoço no Pão de Açúcar', category_id: 'c1' }),
    tx({ id: '2', kind: 'income', category_id: 'c2', account_id: 'a2' }),
  ]
  test('sem filtros devolve tudo', () => expect(filterTransactions(list, {}, labelOf)).toHaveLength(2))
  test('por tipo', () => expect(filterTransactions(list, { kind: 'income' }, labelOf).map((t) => t.id)).toEqual(['2']))
  test('por conta', () => expect(filterTransactions(list, { accountId: 'a2' }, labelOf).map((t) => t.id)).toEqual(['2']))
  test('por categoria', () => expect(filterTransactions(list, { categoryId: 'c1' }, labelOf).map((t) => t.id)).toEqual(['1']))
  test('busca ignora acento e maiúscula na descrição', () =>
    expect(filterTransactions(list, { search: 'pao de acucar' }, labelOf).map((t) => t.id)).toEqual(['1']))
  test('busca pelo nome da categoria', () =>
    expect(filterTransactions(list, { search: 'salario' }, labelOf).map((t) => t.id)).toEqual(['2']))
})

describe('groupByDate', () => {
  test('agrupa por dia, do mais recente ao mais antigo, mantendo a ordem interna', () => {
    const groups = groupByDate([
      tx({ id: 'a', date: '2026-10-01' }),
      tx({ id: 'b', date: '2026-10-05' }),
      tx({ id: 'c', date: '2026-10-01' }),
    ])
    expect(groups.map((g) => g.date)).toEqual(['2026-10-05', '2026-10-01'])
    expect(groups[1].items.map((t) => t.id)).toEqual(['a', 'c'])
  })
})

describe('summarizeByCurrency', () => {
  test('soma entradas e saídas por moeda', () => {
    const s = summarizeByCurrency([
      tx({ kind: 'income', amount: 1000, currency: 'EUR' }),
      tx({ kind: 'expense', amount: 300, currency: 'EUR' }),
      tx({ kind: 'expense', amount: 50, currency: 'BRL' }),
    ])
    expect(s).toEqual([
      { currency: 'BRL', income: 0, expense: 50, net: -50 },
      { currency: 'EUR', income: 1000, expense: 300, net: 700 },
    ])
  })
})
```

`src/features/transactions/defaults.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import type { Transaction } from './types'
import { mostFrequent, pickDefaults } from './defaults'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'id', user_id: 'u', kind: 'expense', amount: 100, currency: 'BRL', date: '2026-10-05',
    category_id: 'c1', description: '', account_id: 'a1', created_at: '', updated_at: '', ...p,
  }
}

describe('mostFrequent', () => {
  test('o mais repetido', () => expect(mostFrequent(['a', 'b', 'b'])).toBe('b'))
  test('empate fica com o primeiro visto', () => expect(mostFrequent(['a', 'b'])).toBe('a'))
  test('lista vazia', () => expect(mostFrequent([])).toBeUndefined())
})

describe('pickDefaults', () => {
  const recent = [
    tx({ account_id: 'a2', category_id: 'c2' }),
    tx({ account_id: 'a2', category_id: 'c2' }),
    tx({ account_id: 'a1', category_id: 'c1' }),
    tx({ kind: 'income', account_id: 'a3', category_id: 'i1' }),
  ]
  test('usa a conta e a categoria mais usadas do tipo', () =>
    expect(pickDefaults(recent, 'expense', ['a1', 'a2', 'a3'], ['c1', 'c2'])).toEqual({ accountId: 'a2', categoryId: 'c2' }))
  test('ignora contas e categorias inativas', () =>
    expect(pickDefaults(recent, 'expense', ['a1'], ['c1'])).toEqual({ accountId: 'a1', categoryId: 'c1' }))
  test('sem histórico usa a primeira conta ativa e nenhuma categoria', () =>
    expect(pickDefaults([], 'income', ['a9'], ['i1'])).toEqual({ accountId: 'a9', categoryId: null }))
  test('sem contas', () => expect(pickDefaults([], 'expense', [], [])).toEqual({ accountId: null, categoryId: null }))
})
```

`src/features/accounts/totals.test.ts`:

```ts
import { expect, test } from 'vitest'
import type { AccountWithBalance } from './types'
import { balancesByCurrency } from './totals'

function acc(p: Partial<AccountWithBalance>): AccountWithBalance {
  return {
    id: 'a', user_id: 'u', name: 'A', type: 'cash', currency: 'BRL', initial_balance: 0, archived: false,
    created_at: '', updated_at: '', balance: 0, ...p,
  }
}

test('soma saldos por moeda e ignora arquivadas', () => {
  expect(
    balancesByCurrency([
      acc({ balance: 1000, currency: 'EUR' }),
      acc({ balance: 500, currency: 'BRL' }),
      acc({ balance: 250, currency: 'EUR' }),
      acc({ balance: 9999, currency: 'EUR', archived: true }),
    ]),
  ).toEqual([
    { currency: 'BRL', total: 500 },
    { currency: 'EUR', total: 1250 },
  ])
})
```

`src/features/categories/label.test.ts`:

```ts
import { expect, test } from 'vitest'
import { categoryLabel } from './label'

const t = (key: string) => `T(${key})`

test('categoria própria usa o nome', () => expect(categoryLabel({ name: 'Café', i18n_key: null }, t)).toBe('Café'))
test('categoria padrão usa a tradução', () =>
  expect(categoryLabel({ name: null, i18n_key: 'food' }, t)).toBe('T(categories.system.food)'))
```

Run: `npm test` → FAIL.

- [ ] **Step 2: Tipos e regras**

`src/features/transactions/types.ts`:

```ts
import type { CurrencyCode } from '../../lib/money'

export type TransactionKind = 'income' | 'expense'

export type Transaction = {
  id: string
  user_id: string
  kind: TransactionKind
  amount: number
  currency: CurrencyCode
  date: string
  category_id: string
  description: string
  account_id: string
  created_at: string
  updated_at: string
}

export type TransactionInput = Pick<Transaction, 'kind' | 'amount' | 'date' | 'category_id' | 'description' | 'account_id'>
```

`src/features/transactions/filters.ts`:

```ts
import type { Transaction, TransactionKind } from './types'

export type TransactionFilters = {
  kind?: TransactionKind
  accountId?: string
  categoryId?: string
  search?: string
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function filterTransactions(
  list: Transaction[],
  filters: TransactionFilters,
  labelOf: (categoryId: string) => string,
): Transaction[] {
  const q = filters.search ? normalize(filters.search) : ''
  return list.filter(
    (tx) =>
      (!filters.kind || tx.kind === filters.kind) &&
      (!filters.accountId || tx.account_id === filters.accountId) &&
      (!filters.categoryId || tx.category_id === filters.categoryId) &&
      (!q || normalize(tx.description).includes(q) || normalize(labelOf(tx.category_id)).includes(q)),
  )
}

export type DayGroup = { date: string; items: Transaction[] }

export function groupByDate(list: Transaction[]): DayGroup[] {
  const byDate = new Map<string, Transaction[]>()
  for (const tx of list) {
    const items = byDate.get(tx.date)
    if (items) items.push(tx)
    else byDate.set(tx.date, [tx])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
}

export type CurrencySummary = { currency: string; income: number; expense: number; net: number }

export function summarizeByCurrency(list: Transaction[]): CurrencySummary[] {
  const byCurrency = new Map<string, CurrencySummary>()
  for (const tx of list) {
    let s = byCurrency.get(tx.currency)
    if (!s) {
      s = { currency: tx.currency, income: 0, expense: 0, net: 0 }
      byCurrency.set(tx.currency, s)
    }
    if (tx.kind === 'income') s.income += tx.amount
    else s.expense += tx.amount
    s.net = s.income - s.expense
  }
  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}
```

`src/features/transactions/defaults.ts`:

```ts
import type { Transaction, TransactionKind } from './types'

export function mostFrequent(ids: string[]): string | undefined {
  const counts = new Map<string, number>()
  let best: string | undefined
  let bestCount = 0
  for (const id of ids) {
    const c = (counts.get(id) ?? 0) + 1
    counts.set(id, c)
    if (c > bestCount) {
      best = id
      bestCount = c
    }
  }
  return best
}

/** Conta e categoria sugeridas para um novo lançamento, a partir dos últimos lançamentos. */
export function pickDefaults(
  recent: Transaction[],
  kind: TransactionKind,
  activeAccountIds: string[],
  activeCategoryIds: string[],
): { accountId: string | null; categoryId: string | null } {
  const ofKind = recent.filter((t) => t.kind === kind)
  const activeAccount = (id: string) => activeAccountIds.includes(id)
  const accountId =
    mostFrequent(ofKind.map((t) => t.account_id).filter(activeAccount)) ??
    mostFrequent(recent.map((t) => t.account_id).filter(activeAccount)) ??
    activeAccountIds[0] ??
    null
  const categoryId =
    mostFrequent(ofKind.map((t) => t.category_id).filter((id) => activeCategoryIds.includes(id))) ?? null
  return { accountId, categoryId }
}
```

`src/features/accounts/types.ts`:

```ts
import type { CurrencyCode } from '../../lib/money'

export const ACCOUNT_TYPES = ['cash', 'checking', 'savings', 'other'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  initial_balance: number
  archived: boolean
  created_at: string
  updated_at: string
}

export type AccountWithBalance = Account & { balance: number }
export type AccountInput = Pick<Account, 'name' | 'type' | 'currency' | 'initial_balance'>
export type AccountPatch = Partial<Pick<Account, 'name' | 'type' | 'initial_balance' | 'archived'>>
```

`src/features/accounts/totals.ts`:

```ts
import type { AccountWithBalance } from './types'

export function balancesByCurrency(accounts: AccountWithBalance[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>()
  for (const a of accounts) {
    if (a.archived) continue
    totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.balance)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, total }))
}
```

`src/features/categories/types.ts`:

```ts
import type { TransactionKind } from '../transactions/types'

export type Category = {
  id: string
  user_id: string | null
  kind: TransactionKind
  name: string | null
  i18n_key: string | null
  icon: string
  color: string
  position: number
  archived: boolean
  created_at: string
  updated_at: string
}

export type CategoryInput = { kind: TransactionKind; name: string; icon: string; color: string }
export type CategoryPatch = Partial<Pick<Category, 'icon' | 'color' | 'archived'>> & { name?: string }
```

`src/features/categories/label.ts`:

```ts
import type { Category } from './types'

export function categoryLabel(cat: Pick<Category, 'name' | 'i18n_key'>, t: (key: string) => string): string {
  return cat.name ?? t(`categories.system.${cat.i18n_key}`)
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: APIs (TanStack Query)**

`src/features/accounts/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Account, AccountInput, AccountPatch, AccountWithBalance } from './types'

export function useAccounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['accounts', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const [accounts, balances] = await Promise.all([
        supabase.from('accounts').select('*').order('created_at'),
        supabase.from('account_balances').select('account_id, balance'),
      ])
      if (accounts.error) throw accounts.error
      if (balances.error) throw balances.error
      const byId = new Map(balances.data.map((b) => [b.account_id as string, Number(b.balance)]))
      return (accounts.data as Account[]).map((a) => ({ ...a, balance: byId.get(a.id) ?? a.initial_balance }))
    },
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AccountInput) => {
      const { data, error } = await supabase.from('accounts').insert(input).select().single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AccountPatch }) => {
      const { data, error } = await supabase.from('accounts').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
```

`src/features/categories/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import type { Category, CategoryInput, CategoryPatch } from './types'

export function useCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['categories', user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('position').order('created_at')
      if (error) throw error
      return data as Category[]
    },
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data, error } = await supabase.from('categories').insert(input).select().single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CategoryPatch }) => {
      const { data, error } = await supabase.from('categories').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
```

`src/features/transactions/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { monthRange } from '../../lib/dates'
import { useAuth } from '../auth/auth-context'
import type { Transaction, TransactionInput } from './types'

export function useTransactions(month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'month', month],
    enabled: !!user,
    queryFn: async () => {
      const { start, end } = monthRange(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useRecentTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'recent'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useTransaction(id: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, 'one', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Transaction
    },
  })
}

function useInvalidateFinance() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
    ])
}

export function useCreateTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { data, error } = await supabase.from('transactions').insert(input).select().single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TransactionInput }) => {
      const { data, error } = await supabase.from('transactions').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
```

- [ ] **Step 4: `npm test` e `npm run build` → verdes. Commit** — `feat: tipos, API e regras de contas, categorias e lançamentos`.

---

### Task 5: Componentes de interface reutilizáveis

**Files:**
- Create: `src/components/ui/Sheet.tsx`, `SegmentedControl.tsx`, `EmptyState.tsx`, `QueryError.tsx`, `MonthSwitcher.tsx`, `AmountKeypad.tsx`, `AmountKeypad.test.tsx`; `src/features/categories/icons.ts`; `src/components/CategoryIcon.tsx`

**Interfaces:**
- Consumes: `appendDigit`, `removeDigit`, `formatMoney`, `formatMonth`, `shiftMonth`, `Button`, chaves `common.close`, `common.retry`, `common.errorGeneric`, `transactions.backspace`, `transactions.previousMonth`, `transactions.nextMonth`
- Produces:
  - `<Sheet open: boolean onClose: () => void title: string>{children}</Sheet>` — painel inferior no celular, modal centralizado no PC (`lg`); fecha com Esc, clique fora e botão X; trava a rolagem do fundo; foca o primeiro campo.
  - `<SegmentedControl<T extends string> value: T options: { value: T; label: string }[] onChange: (v: T) => void label: string />` (radiogroup)
  - `<EmptyState icon: LucideIcon title: string description?: string action?: ReactNode />`
  - `<QueryError onRetry: () => void />`
  - `<MonthSwitcher month: string locale: string onChange: (month: string) => void />`
  - `<AmountKeypad value: number onChange: (cents: number) => void currency: string locale: string label: string error?: string />`
  - `CATEGORY_ICONS: Record<string, LucideIcon>`; `CATEGORY_ICON_NAMES: string[]`; `CATEGORY_COLORS: string[]`; `<CategoryIcon icon: string color: string size?: 'sm' | 'md' />`

- [ ] **Step 1: Teste do teclado de valor (falha)**

`src/components/ui/AmountKeypad.test.tsx`:

```tsx
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../i18n'
import { AmountKeypad } from './AmountKeypad'

function Harness() {
  const [v, setV] = useState(0)
  return <AmountKeypad value={v} onChange={setV} currency="USD" locale="en" label="Amount" />
}

describe('AmountKeypad', () => {
  test('digitar pelos botões forma o valor da direita para a esquerda', async () => {
    render(<Harness />)
    for (const d of ['1', '2', '3']) await userEvent.click(screen.getByRole('button', { name: d }))
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$1.23')
  })

  test('botão 00 e apagar', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$5.00')
    await userEvent.click(screen.getByRole('button', { name: /delete digit/i }))
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$0.50')
  })

  test('teclado físico funciona com o visor focado', async () => {
    render(<Harness />)
    screen.getByRole('textbox', { name: 'Amount' }).focus()
    await userEvent.keyboard('42{Backspace}7')
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveTextContent('$0.47')
  })
})
```

Run: `npm test` → FAIL.

- [ ] **Step 2: Implementar**

`src/components/ui/AmountKeypad.tsx`:

```tsx
import type { KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Delete } from 'lucide-react'
import { appendDigit, removeDigit } from '../../lib/amount'
import { formatMoney } from '../../lib/money'

type Props = {
  value: number
  onChange: (cents: number) => void
  currency: string
  locale: string
  label: string
  error?: string
}

function Key({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="grid h-14 place-items-center rounded-2xl bg-surface-2 text-2xl font-semibold text-fg transition
        active:scale-95 hover:bg-line focus-visible:outline-2 focus-visible:outline-primary">
      {children}
    </button>
  )
}

export function AmountKeypad({ value, onChange, currency, locale, label, error }: Props) {
  const { t } = useTranslation()
  const press = (digit: number) => onChange(appendDigit(value, digit))

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      press(Number(e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      onChange(removeDigit(value))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="textbox" tabIndex={0} aria-label={label} aria-readonly="true" aria-live="polite"
        aria-invalid={error ? true : undefined} onKeyDown={onKeyDown}
        className={`rounded-2xl px-4 py-3 text-center text-4xl font-bold tabular-nums outline-none
          focus-visible:ring-2 focus-visible:ring-primary ${value === 0 ? 'text-muted' : 'text-fg'}`}>
        {formatMoney(value, currency, locale)}
      </div>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Key key={d} onClick={() => press(d)}>{d}</Key>
        ))}
        <Key onClick={() => onChange(appendDigit(appendDigit(value, 0), 0))}>00</Key>
        <Key onClick={() => press(0)}>0</Key>
        <Key onClick={() => onChange(removeDigit(value))} label={t('transactions.backspace')}>
          <Delete className="size-6" aria-hidden="true" />
        </Key>
      </div>
    </div>
  )
}
```

`src/components/ui/Sheet.tsx`:

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode }

export function Sheet({ open, onClose, title, children }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    ;(panel?.querySelector<HTMLElement>('input, select, textarea') ?? panel?.querySelector<HTMLElement>('button'))?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center lg:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]
          shadow-xl lg:max-w-lg lg:rounded-3xl lg:pb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
```

`src/components/ui/SegmentedControl.tsx`:

```tsx
type Option<T extends string> = { value: T; label: string }
type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }

export function SegmentedControl<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`h-10 rounded-xl text-sm font-semibold transition ${
            o.value === value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

`src/components/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = { icon: LucideIcon; title: string; description?: string; action?: ReactNode }

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <Icon className="size-10 text-muted" aria-hidden="true" />
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  )
}
```

`src/components/ui/QueryError.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export function QueryError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
      <AlertTriangle className="size-8 text-danger" aria-hidden="true" />
      <p className="text-sm text-muted">{t('common.errorGeneric')}</p>
      <Button variant="secondary" className="h-10" onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  )
}
```

`src/components/ui/MonthSwitcher.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth, shiftMonth } from '../../lib/dates'

type Props = { month: string; locale: string; onChange: (month: string) => void }

export function MonthSwitcher({ month, locale, onChange }: Props) {
  const { t } = useTranslation()
  const btn = 'grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg'
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-1 py-1">
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('transactions.previousMonth')}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <span className="font-semibold capitalize" aria-live="polite">{formatMonth(month, locale)}</span>
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, 1))} aria-label={t('transactions.nextMonth')}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
```

`src/features/categories/icons.ts` (nomes de ícone gravados no banco → componentes lucide; se algum export não existir na versão instalada do `lucide-react`, usar o equivalente mais próximo **mantendo a chave**):

```ts
import {
  Baby, BookOpen, Briefcase, Car, CircleEllipsis, Coffee, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap,
  HeartPulse, Home, Landmark, Laptop, Lightbulb, Music, PartyPopper, PawPrint, PiggyBank, Plane, Receipt, Repeat,
  Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Tag, TrendingUp, Utensils, Wallet, Wrench,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-cart': ShoppingCart, car: Car, home: Home, lightbulb: Lightbulb,
  'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap, 'party-popper': PartyPopper,
  'shopping-bag': ShoppingBag, repeat: Repeat, plane: Plane, 'paw-print': PawPrint, landmark: Landmark,
  'circle-ellipsis': CircleEllipsis, briefcase: Briefcase, laptop: Laptop, 'trending-up': TrendingUp, gift: Gift,
  coffee: Coffee, dumbbell: Dumbbell, baby: Baby, shirt: Shirt, smartphone: Smartphone, fuel: Fuel,
  'book-open': BookOpen, music: Music, film: Film, wrench: Wrench, 'piggy-bank': PiggyBank, wallet: Wallet,
  receipt: Receipt, 'gamepad-2': Gamepad2, sparkles: Sparkles, tag: Tag,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS)

export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b', '#94a3b8',
]
```

`src/components/CategoryIcon.tsx`:

```tsx
import { Tag } from 'lucide-react'
import { CATEGORY_ICONS } from '../features/categories/icons'

type Props = { icon: string; color: string; size?: 'sm' | 'md' }

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag
  const box = size === 'sm' ? 'size-8' : 'size-10'
  const glyph = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-full`}
      style={{ backgroundColor: `${color}26`, color }}>
      <Icon className={glyph} aria-hidden="true" />
    </span>
  )
}
```

- [ ] **Step 3: `npm test` → PASS (incluindo AmountKeypad), `npm run build` → OK. Commit** — `feat: componentes de interface (painel, teclado de valor, seletores)`.

---

### Task 6: Contas — formulário, página e links nas Configurações

**Files:**
- Create: `src/features/accounts/accountTypes.ts`, `src/features/accounts/AccountForm.tsx`, `src/features/accounts/AccountsPage.tsx`
- Modify: `src/app/router.tsx` (rota `/accounts`), `src/features/settings/SettingsPage.tsx` (links "Contas" e "Categorias")

**Interfaces:**
- Consumes: Task 4 (`useAccounts`, `useCreateAccount`, `useUpdateAccount`, `useDeleteAccount`, `ACCOUNT_TYPES`, tipos, `balancesByCurrency`), Task 5 (`Sheet`, `EmptyState`, `QueryError`), Task 2 (`parseAmount`, `formatAmountPlain`, `isForeignKeyViolation`), `useProfile`, `formatMoney`, `CURRENCIES`, `currencyName`, `normalizeLocale`, `TextField`, `SelectField`, `Button`, `FullScreenSpinner`
- Produces: `ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon>`; `<AccountForm initial: AccountInput currencyEditable: boolean submitLabel: string loading?: boolean error?: string | null onSubmit: (v: AccountInput) => void>{children? (botões extras)}</AccountForm>`; página default `AccountsPage`; rota `/accounts`.

- [ ] **Step 1: `src/features/accounts/accountTypes.ts`**

```ts
import { CircleDollarSign, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import type { AccountType } from './types'

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  cash: Wallet,
  checking: Landmark,
  savings: PiggyBank,
  other: CircleDollarSign,
}
```

- [ ] **Step 2: `src/features/accounts/AccountForm.tsx`**

```tsx
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatAmountPlain, parseAmount } from '../../lib/amount'
import { normalizeLocale } from '../../lib/locale'
import { CURRENCIES, currencyName, type CurrencyCode } from '../../lib/money'
import { ACCOUNT_TYPES, type AccountInput, type AccountType } from './types'

type Props = {
  initial: AccountInput
  currencyEditable: boolean
  submitLabel: string
  loading?: boolean
  error?: string | null
  onSubmit: (value: AccountInput) => void
  children?: ReactNode
}

export function AccountForm({ initial, currencyEditable, submitLabel, loading, error, onSubmit, children }: Props) {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [name, setName] = useState(initial.name)
  const [type, setType] = useState<AccountType>(initial.type)
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency)
  const [balanceText, setBalanceText] = useState(
    initial.initial_balance ? formatAmountPlain(initial.initial_balance, locale) : '',
  )
  const [balanceError, setBalanceError] = useState<string | undefined>()

  function submit(e: FormEvent) {
    e.preventDefault()
    const cents = balanceText.trim() === '' ? 0 : parseAmount(balanceText)
    if (cents === null) return setBalanceError(t('accounts.invalidBalance'))
    setBalanceError(undefined)
    onSubmit({ name: name.trim(), type, currency, initial_balance: cents })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label={t('accounts.name')} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <SelectField label={t('accounts.type')} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
        {ACCOUNT_TYPES.map((v) => <option key={v} value={v}>{t(`accounts.types.${v}`)}</option>)}
      </SelectField>
      <div>
        <SelectField label={t('accounts.currency')} value={currency} disabled={!currencyEditable}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {currencyName(c, locale)}</option>)}
        </SelectField>
        {!currencyEditable && <p className="mt-1 text-xs text-muted">{t('accounts.currencyLocked')}</p>}
      </div>
      <TextField label={t('accounts.initialBalance')} inputMode="decimal" placeholder={formatAmountPlain(0, locale)}
        value={balanceText} error={balanceError} onChange={(e) => setBalanceText(e.target.value)} />
      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
      {children}
    </form>
  )
}
```

- [ ] **Step 3: `src/features/accounts/AccountsPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { isForeignKeyViolation } from '../../lib/db-errors'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useProfile } from '../profile/api'
import { ACCOUNT_TYPE_ICONS } from './accountTypes'
import { AccountForm } from './AccountForm'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from './api'
import { balancesByCurrency } from './totals'
import type { AccountInput, AccountWithBalance } from './types'

export default function AccountsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const { data: profile } = useProfile()
  const { data: accounts, isPending, isError, refetch } = useAccounts()
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const remove = useDeleteAccount()
  const [editing, setEditing] = useState<AccountWithBalance | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isPending) return <FullScreenSpinner />
  if (isError || !accounts) return <QueryError onRetry={() => void refetch()} />

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const totals = balancesByCurrency(accounts)

  function open(target: AccountWithBalance | 'new') {
    setError(null)
    setConfirmDelete(false)
    setEditing(target)
  }

  async function save(value: AccountInput) {
    try {
      if (editing === 'new') await create.mutateAsync(value)
      else if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { name: value.name, type: value.type, initial_balance: value.initial_balance },
        })
      }
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function toggleArchive(account: AccountWithBalance) {
    try {
      await update.mutateAsync({ id: account.id, patch: { archived: !account.archived } })
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function destroy(account: AccountWithBalance) {
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(account.id)
      setEditing(null)
    } catch (e) {
      setConfirmDelete(false)
      setError(t(isForeignKeyViolation(e) ? 'accounts.deleteBlocked' : 'common.errorGeneric'))
    }
  }

  const row = (a: AccountWithBalance) => {
    const Icon = ACCOUNT_TYPE_ICONS[a.type]
    return (
      <li key={a.id}>
        <button type="button" onClick={() => open(a)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:bg-surface-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.name}</span>
            <span className="block text-sm text-muted">{t(`accounts.types.${a.type}`)} · {a.currency}</span>
          </span>
          <span className={`font-semibold tabular-nums ${a.balance < 0 ? 'text-danger' : ''}`}>
            {formatMoney(a.balance, a.currency, locale)}
          </span>
        </button>
      </li>
    )
  }

  const editingAccount = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('accounts.title')}</h1>
        <Button className="h-10" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('accounts.new')}
        </Button>
      </div>

      {totals.length > 0 && (
        <div className="mt-6 rounded-2xl bg-primary p-5 text-primary-fg">
          <p className="text-sm opacity-80">{t('accounts.total')}</p>
          {totals.map((s) => (
            <p key={s.currency} className="text-2xl font-bold tabular-nums">{formatMoney(s.total, s.currency, locale)}</p>
          ))}
        </div>
      )}

      <div className="mt-6">
        {active.length === 0 ? (
          <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
            action={<Button className="h-10" onClick={() => open('new')}>{t('accounts.new')}</Button>} />
        ) : (
          <ul className="flex flex-col gap-2">{active.map(row)}</ul>
        )}
      </div>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer py-2 text-sm font-medium text-muted">{t('accounts.archivedSection')}</summary>
          <ul className="mt-2 flex flex-col gap-2 opacity-70">{archived.map(row)}</ul>
        </details>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? t('accounts.new') : t('accounts.edit')}>
        {editing && (
          <AccountForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new'
              ? { name: '', type: 'checking', currency: profile?.currency ?? 'BRL', initial_balance: 0 }
              : editing}
            currencyEditable={editing === 'new'}
            submitLabel={t('common.save')}
            loading={create.isPending || update.isPending}
            error={error}
            onSubmit={(v) => void save(v)}
          >
            {editingAccount && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => void toggleArchive(editingAccount)}>
                  {editingAccount.archived ? t('common.unarchive') : t('common.archive')}
                </Button>
                <Button type="button" variant="danger" loading={remove.isPending} onClick={() => void destroy(editingAccount)}>
                  {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
                </Button>
              </div>
            )}
          </AccountForm>
        )}
      </Sheet>
    </section>
  )
}
```

- [ ] **Step 4: Rota e links**

Em `src/app/router.tsx`, dentro dos filhos de `<AppShell />`, adicionar `{ path: '/accounts', element: <AccountsPage /> }` (import default de `../features/accounts/AccountsPage`). A rota `/categories` entra na Task 7.

Em `src/features/settings/SettingsPage.tsx`, logo abaixo do `<h1>`, inserir:

```tsx
<nav aria-label={t('settings.title')} className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
  {[
    { to: '/accounts', label: t('accounts.title'), icon: Landmark },
    { to: '/categories', label: t('categories.title'), icon: Tags },
  ].map(({ to, label, icon: Icon }) => (
    <Link key={to} to={to} className="flex min-h-14 items-center gap-3 border-b border-line px-5 last:border-b-0 hover:bg-surface-2">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="size-5 text-muted" aria-hidden="true" />
    </Link>
  ))}
</nav>
```

(imports: `Link` de `react-router`; `ChevronRight, Landmark, Tags` de `lucide-react`.)

- [ ] **Step 5: `npm test` e `npm run build` → verdes. Commit** — `feat: tela de contas e atalhos nas configurações`.

---

### Task 7: Categorias — formulário e página

**Files:**
- Create: `src/features/categories/CategoryForm.tsx`, `src/features/categories/CategoriesPage.tsx`
- Modify: `src/app/router.tsx` (rota `/categories`)

**Interfaces:**
- Consumes: Task 4 (`useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `categoryLabel`, tipos), Task 5 (`Sheet`, `SegmentedControl`, `QueryError`, `CATEGORY_ICONS`, `CATEGORY_ICON_NAMES`, `CATEGORY_COLORS`, `CategoryIcon`), `isForeignKeyViolation`, `TextField`, `Button`, `FullScreenSpinner`
- Produces: `<CategoryForm initial: { name: string; icon: string; color: string } submitLabel loading? error? onSubmit: (v: { name: string; icon: string; color: string }) => void>{children?}</CategoryForm>`; página default `CategoriesPage`; rota `/categories`.

- [ ] **Step 1: `src/features/categories/CategoryForm.tsx`**

```tsx
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { CategoryIcon } from '../../components/CategoryIcon'
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES, CATEGORY_ICONS } from './icons'

type Value = { name: string; icon: string; color: string }
type Props = {
  initial: Value
  submitLabel: string
  loading?: boolean
  error?: string | null
  onSubmit: (value: Value) => void
  children?: ReactNode
}

export function CategoryForm({ initial, submitLabel, loading, error, onSubmit, children }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState<Value>(initial)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ ...value, name: value.name.trim() })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <CategoryIcon icon={value.icon} color={value.color} />
        <TextField className="flex-1" label={t('categories.name')} required maxLength={40}
          value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('categories.icon')}</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
          {CATEGORY_ICON_NAMES.map((name) => {
            const Icon = CATEGORY_ICONS[name]
            return (
              <label key={name} className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-line text-muted
                has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary">
                <input type="radio" name="icon" value={name} className="sr-only" checked={value.icon === name}
                  onChange={() => setValue({ ...value, icon: name })} aria-label={name} />
                <Icon className="size-5" aria-hidden="true" />
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('categories.color')}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <label key={c} className="grid size-10 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface
              has-checked:ring-2 has-checked:ring-fg" style={{ backgroundColor: c }}>
              <input type="radio" name="color" value={c} className="sr-only" checked={value.color === c}
                onChange={() => setValue({ ...value, color: c })} aria-label={c} />
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={loading}>{submitLabel}</Button>
      {children}
    </form>
  )
}
```

- [ ] **Step 2: `src/features/categories/CategoriesPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { CategoryIcon } from '../../components/CategoryIcon'
import { isForeignKeyViolation } from '../../lib/db-errors'
import type { TransactionKind } from '../transactions/types'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './api'
import { CategoryForm } from './CategoryForm'
import { CATEGORY_COLORS } from './icons'
import { categoryLabel } from './label'
import type { Category } from './types'

export default function CategoriesPage() {
  const { t } = useTranslation()
  const { data: categories, isPending, isError, refetch } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [kind, setKind] = useState<TransactionKind>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isPending) return <FullScreenSpinner />
  if (isError || !categories) return <QueryError onRetry={() => void refetch()} />

  const ofKind = categories.filter((c) => c.kind === kind)
  const active = ofKind.filter((c) => !c.archived)
  const archived = ofKind.filter((c) => c.archived)

  function open(target: Category | 'new') {
    setError(null)
    setConfirmDelete(false)
    setEditing(target)
  }

  async function save(value: { name: string; icon: string; color: string }) {
    try {
      if (editing === 'new') await create.mutateAsync({ kind, ...value })
      else if (editing) await update.mutateAsync({ id: editing.id, patch: value })
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function toggleArchive(cat: Category) {
    try {
      await update.mutateAsync({ id: cat.id, patch: { archived: !cat.archived } })
      setEditing(null)
    } catch {
      setError(t('common.errorGeneric'))
    }
  }

  async function destroy(cat: Category) {
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(cat.id)
      setEditing(null)
    } catch (e) {
      setConfirmDelete(false)
      setError(t(isForeignKeyViolation(e) ? 'categories.deleteBlocked' : 'common.errorGeneric'))
    }
  }

  const item = (c: Category) => {
    const system = c.user_id === null
    return (
      <li key={c.id}>
        <button type="button" disabled={system} onClick={() => open(c)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left
            enabled:hover:bg-surface-2 disabled:cursor-default">
          <CategoryIcon icon={c.icon} color={c.color} />
          <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel(c, t)}</span>
          {system && <Lock className="size-4 text-muted" aria-label={t('common.default')} />}
        </button>
      </li>
    )
  }

  const editingCategory = editing && editing !== 'new' ? editing : null

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('categories.title')}</h1>
        <Button className="h-10" onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden="true" /> {t('categories.new')}
        </Button>
      </div>

      <div className="mt-6">
        <SegmentedControl label={t('categories.title')} value={kind} onChange={setKind}
          options={[
            { value: 'expense', label: t('categories.expense') },
            { value: 'income', label: t('categories.income') },
          ]} />
      </div>

      <p className="mt-3 text-xs text-muted">{t('categories.systemHint')}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{active.map(item)}</ul>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer py-2 text-sm font-medium text-muted">{t('categories.archivedSection')}</summary>
          <ul className="mt-2 grid gap-2 opacity-70 sm:grid-cols-2">{archived.map(item)}</ul>
        </details>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? t('categories.new') : t('categories.edit')}>
        {editing && (
          <CategoryForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new'
              ? { name: '', icon: 'tag', color: CATEGORY_COLORS[6] }
              : { name: editing.name ?? '', icon: editing.icon, color: editing.color }}
            submitLabel={t('common.save')}
            loading={create.isPending || update.isPending}
            error={error}
            onSubmit={(v) => void save(v)}
          >
            {editingCategory && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => void toggleArchive(editingCategory)}>
                  {editingCategory.archived ? t('common.unarchive') : t('common.archive')}
                </Button>
                <Button type="button" variant="danger" loading={remove.isPending} onClick={() => void destroy(editingCategory)}>
                  {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
                </Button>
              </div>
            )}
          </CategoryForm>
        )}
      </Sheet>
    </section>
  )
}
```

- [ ] **Step 3: Rota** — em `src/app/router.tsx`, adicionar `{ path: '/categories', element: <CategoriesPage /> }` nos filhos do `<AppShell />`.

- [ ] **Step 4: `npm test` e `npm run build` → verdes. Commit** — `feat: tela de categorias`.

---

### Task 8: Formulário de lançamento (novo e edição)

**Files:**
- Create: `src/features/transactions/TransactionRow.tsx`, `src/features/transactions/TransactionFormPage.tsx`
- Modify: `src/app/router.tsx` (`/new` e `/transactions/:id/edit` → `TransactionFormPage`)

**Interfaces:**
- Consumes: Tasks 2, 4, 5; `useProfile`; `SelectField`, `TextField`, `Button`, `FullScreenSpinner`
- Produces:
  - `<TransactionRow transaction: Transaction category?: Category account?: Account locale: string />` — link para `/transactions/:id/edit`; despesa em vermelho com "−", receita em verde com "+".
  - Página default `TransactionFormPage`; ao salvar, navega para `/transactions?m=<YYYY-MM do lançamento>`.

- [ ] **Step 1: `src/features/transactions/TransactionRow.tsx`**

```tsx
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CategoryIcon } from '../../components/CategoryIcon'
import { formatMoney } from '../../lib/money'
import type { Account } from '../accounts/types'
import { categoryLabel } from '../categories/label'
import type { Category } from '../categories/types'
import type { Transaction } from './types'

type Props = { transaction: Transaction; category?: Category; account?: Account; locale: string }

export function TransactionRow({ transaction: tx, category, account, locale }: Props) {
  const { t } = useTranslation()
  const label = category ? categoryLabel(category, t) : ''
  const income = tx.kind === 'income'
  return (
    <Link to={`/transactions/${tx.id}/edit`}
      className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary">
      {category && <CategoryIcon icon={category.icon} color={category.color} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.description || label}</span>
        <span className="block truncate text-sm text-muted">
          {tx.description ? `${label} · ` : ''}{account?.name ?? ''}
        </span>
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${income ? 'text-success' : 'text-danger'}`}>
        {income ? '+' : '−'}{formatMoney(tx.amount, tx.currency, locale)}
      </span>
    </Link>
  )
}
```

- [ ] **Step 2: `src/features/transactions/TransactionFormPage.tsx`**

```tsx
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { AmountKeypad } from '../../components/ui/AmountKeypad'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/SelectField'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { CategoryIcon } from '../../components/CategoryIcon'
import { monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { useAccounts } from '../accounts/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useProfile } from '../profile/api'
import { useCreateTransaction, useDeleteTransaction, useRecentTransactions, useTransaction, useUpdateTransaction } from './api'
import { pickDefaults } from './defaults'
import type { TransactionKind } from './types'

type Draft = {
  kind: TransactionKind
  amount: number
  categoryId: string | null
  accountId: string | null
  date: string
  description: string
}

type Errors = Partial<Record<'amount' | 'category' | 'account', string>>

export default function TransactionFormPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const { data: recent = [] } = useRecentTransactions()
  const existingQuery = useTransaction(id)
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [saveError, setSaveError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const accounts = accountsQuery.data
  const categories = categoriesQuery.data
  const existing = existingQuery.data

  const base = useMemo<Draft | null>(() => {
    if (!accounts || !categories) return null
    if (id) {
      if (!existing) return null
      return {
        kind: existing.kind, amount: existing.amount, categoryId: existing.category_id,
        accountId: existing.account_id, date: existing.date, description: existing.description,
      }
    }
    const activeAccounts = accounts.filter((a) => !a.archived).map((a) => a.id)
    const activeCats = categories.filter((c) => !c.archived && c.kind === 'expense').map((c) => c.id)
    const d = pickDefaults(recent, 'expense', activeAccounts, activeCats)
    return { kind: 'expense', amount: 0, categoryId: d.categoryId, accountId: d.accountId, date: todayISO(), description: '' }
  }, [id, existing, accounts, categories, recent])

  if (accountsQuery.isError || categoriesQuery.isError || existingQuery.isError) {
    return <QueryError onRetry={() => {
      void accountsQuery.refetch()
      void categoriesQuery.refetch()
      if (id) void existingQuery.refetch()
    }} />
  }
  if (!base || !accounts || !categories) return <FullScreenSpinner />

  const form = draft ?? base
  const selectableAccounts = accounts.filter((a) => !a.archived || a.id === form.accountId)
  if (selectableAccounts.length === 0) {
    return (
      <EmptyState icon={Wallet} title={t('transactions.noAccounts')}
        action={<Link to="/accounts" className="font-semibold text-primary">{t('transactions.goToAccounts')}</Link>} />
    )
  }

  const selectableCategories = categories.filter(
    (c) => c.kind === form.kind && (!c.archived || c.id === form.categoryId),
  )
  const account = accounts.find((a) => a.id === form.accountId)
  const currency = account?.currency ?? profile?.currency ?? 'BRL'

  function set(patch: Partial<Draft>) {
    setDraft({ ...form, ...patch })
    setSaveError(false)
  }

  function changeKind(kind: TransactionKind) {
    if (kind === form.kind) return
    const activeCats = categories!.filter((c) => !c.archived && c.kind === kind).map((c) => c.id)
    const activeAccounts = accounts!.filter((a) => !a.archived).map((a) => a.id)
    const d = pickDefaults(recent, kind, activeAccounts, activeCats)
    set({ kind, categoryId: d.categoryId })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (form.amount <= 0) next.amount = t('transactions.errors.amount')
    if (!form.categoryId) next.category = t('transactions.errors.category')
    if (!form.accountId) next.account = t('transactions.errors.account')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input = {
      kind: form.kind, amount: form.amount, date: form.date, category_id: form.categoryId!,
      description: form.description.trim(), account_id: form.accountId!,
    }
    try {
      if (id) await update.mutateAsync({ id, input })
      else await create.mutateAsync(input)
      navigate(`/transactions?m=${monthOf(form.date)}`, { replace: true })
    } catch {
      setSaveError(true)
    }
  }

  async function onDelete() {
    if (!id) return
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await remove.mutateAsync(id)
      navigate(`/transactions?m=${monthOf(form.date)}`, { replace: true })
    } catch {
      setConfirmDelete(false)
      setSaveError(true)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{id ? t('transactions.edit') : t('transactions.new')}</h1>

      <SegmentedControl label={t('transactions.title')} value={form.kind} onChange={changeKind}
        options={[
          { value: 'expense', label: t('transactions.expense') },
          { value: 'income', label: t('transactions.income') },
        ]} />

      <AmountKeypad value={form.amount} onChange={(amount) => set({ amount })} currency={currency} locale={locale}
        label={t('transactions.amount')} error={errors.amount} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('transactions.category')}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {selectableCategories.map((c) => (
            <label key={c.id} className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-2 text-center
              has-checked:border-primary has-checked:bg-primary/10">
              <input type="radio" name="category" className="sr-only" value={c.id} checked={form.categoryId === c.id}
                onChange={() => set({ categoryId: c.id })} />
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="line-clamp-2 text-xs font-medium">{categoryLabel(c, t)}</span>
            </label>
          ))}
        </div>
        {errors.category && <p className="mt-1 text-sm text-danger">{errors.category}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SelectField label={t('transactions.account')} value={form.accountId ?? ''}
            onChange={(e) => set({ accountId: e.target.value || null })}>
            <option value="" disabled>—</option>
            {selectableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </SelectField>
          {errors.account && <p className="mt-1 text-sm text-danger">{errors.account}</p>}
        </div>
        <TextField label={t('transactions.date')} type="date" required value={form.date}
          onChange={(e) => set({ date: e.target.value || todayISO() })} />
      </div>

      <TextField label={t('transactions.description')} maxLength={140} placeholder={t('transactions.descriptionPlaceholder')}
        value={form.description} onChange={(e) => set({ description: e.target.value })} />

      {saveError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t('common.errorGeneric')}</p>}

      <Button type="submit" full loading={create.isPending || update.isPending}>{t('transactions.save')}</Button>
      {id && (
        <Button type="button" variant="danger" full loading={remove.isPending} onClick={() => void onDelete()}>
          {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
        </Button>
      )}
    </form>
  )
}
```

- [ ] **Step 3: Rotas** — em `src/app/router.tsx`: trocar o placeholder de `/new` por `<TransactionFormPage />` e adicionar `{ path: '/transactions/:id/edit', element: <TransactionFormPage /> }`.

- [ ] **Step 4: `npm test` e `npm run build` → verdes. Commit** — `feat: formulário de lançamento com teclado de valor`.

---

### Task 9: Lista de lançamentos, Início e primeira conta no onboarding

**Files:**
- Create: `src/features/transactions/TransactionsPage.tsx`, `src/features/home/HomePage.tsx`
- Modify: `src/app/router.tsx` (`/` → `HomePage`, `/transactions` → `TransactionsPage`; remover import de `PlaceholderPage` se não houver mais uso — manter para `/cards` e `/groups`), `src/features/onboarding/OnboardingPage.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 2–8; `useProfile`, `useUpdateProfile`
- Produces: páginas `TransactionsPage` (mês em `?m=YYYY-MM`) e `HomePage`; onboarding em 2 passos.

- [ ] **Step 1: `src/features/transactions/TransactionsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ReceiptText, Search } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { MonthSwitcher } from '../../components/ui/MonthSwitcher'
import { QueryError } from '../../components/ui/QueryError'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { formatDay, isMonth, monthOf, relativeDay, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useAccounts } from '../accounts/api'
import { useCategories } from '../categories/api'
import { categoryLabel } from '../categories/label'
import { useTransactions } from './api'
import { filterTransactions, groupByDate, summarizeByCurrency, type TransactionFilters } from './filters'
import { TransactionRow } from './TransactionRow'
import type { TransactionKind } from './types'

const selectClass = 'h-11 min-w-0 rounded-xl border border-line bg-surface px-3 text-base text-fg outline-none focus:border-primary'

export default function TransactionsPage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const month = isMonth(raw) ? raw : monthOf(todayISO())
  const { data: transactions, isPending, isError, refetch } = useTransactions(month)
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const [filters, setFilters] = useState<TransactionFilters>({})

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const today = todayISO()
  const visible = filterTransactions(transactions ?? [], filters, (id) => {
    const c = categoriesById.get(id)
    return c ? categoryLabel(c, t) : ''
  })
  const groups = groupByDate(visible)
  const summary = summarizeByCurrency(visible)
  const hasFilters = !!(filters.kind || filters.accountId || filters.categoryId || filters.search)

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('transactions.title')}</h1>
      <MonthSwitcher month={month} locale={locale} onChange={(m) => setParams({ m }, { replace: true })} />

      {summary.map((s) => (
        <dl key={s.currency} className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
          <div><dt className="text-xs text-muted">{t('transactions.income_total')}</dt>
            <dd className="font-semibold tabular-nums text-success">{formatMoney(s.income, s.currency, locale)}</dd></div>
          <div><dt className="text-xs text-muted">{t('transactions.expense_total')}</dt>
            <dd className="font-semibold tabular-nums text-danger">{formatMoney(s.expense, s.currency, locale)}</dd></div>
          <div><dt className="text-xs text-muted">{t('transactions.net_total')}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(s.net, s.currency, locale)}</dd></div>
        </dl>
      ))}

      <div className="flex flex-col gap-2">
        <label className="relative">
          <span className="sr-only">{t('transactions.search')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={filters.search ?? ''} placeholder={t('transactions.searchPlaceholder')}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-base outline-none focus:border-primary" />
        </label>
        <SegmentedControl<'all' | TransactionKind> label={t('transactions.title')} value={filters.kind ?? 'all'}
          onChange={(v) => setFilters({ ...filters, kind: v === 'all' ? undefined : v })}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'expense', label: t('transactions.expense') },
            { value: 'income', label: t('transactions.income') },
          ]} />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label={t('transactions.account')} className={selectClass} value={filters.accountId ?? ''}
            onChange={(e) => setFilters({ ...filters, accountId: e.target.value || undefined })}>
            <option value="">{t('transactions.allAccounts')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label={t('transactions.category')} className={selectClass} value={filters.categoryId ?? ''}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || undefined })}>
            <option value="">{t('transactions.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c, t)}</option>)}
          </select>
        </div>
      </div>

      {isPending ? (
        <FullScreenSpinner />
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon={ReceiptText}
          title={hasFilters ? t('transactions.noResults') : t('transactions.empty')}
          description={hasFilters ? undefined : t('transactions.emptyBody')}
          action={hasFilters ? undefined : <Link to="/new" className="font-semibold text-primary">{t('transactions.new')}</Link>} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const rel = relativeDay(g.date, today)
            return (
              <section key={g.date} aria-label={formatDay(g.date, locale)}>
                <h2 className="px-3 pb-1 text-sm font-semibold capitalize text-muted">
                  {rel ? t(`transactions.${rel}`) : formatDay(g.date, locale)}
                </h2>
                <ul className="rounded-2xl border border-line bg-surface p-1">
                  {g.items.map((tx) => (
                    <li key={tx.id}>
                      <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                        account={accountsById.get(tx.account_id)} locale={locale} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: `src/features/home/HomePage.tsx`**

```tsx
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Wallet } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryError } from '../../components/ui/QueryError'
import { FullScreenSpinner } from '../../components/ui/Spinner'
import { monthOf, todayISO } from '../../lib/dates'
import { normalizeLocale } from '../../lib/locale'
import { formatMoney } from '../../lib/money'
import { useAccounts } from '../accounts/api'
import { balancesByCurrency } from '../accounts/totals'
import { useCategories } from '../categories/api'
import { useProfile } from '../profile/api'
import { useRecentTransactions, useTransactions } from '../transactions/api'
import { summarizeByCurrency } from '../transactions/filters'
import { TransactionRow } from '../transactions/TransactionRow'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const locale = normalizeLocale(i18n.language)
  const { data: profile } = useProfile()
  const accountsQuery = useAccounts()
  const { data: categories = [] } = useCategories()
  const month = monthOf(todayISO())
  const { data: monthTx = [] } = useTransactions(month)
  const { data: recent = [] } = useRecentTransactions()

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map((accountsQuery.data ?? []).map((a) => [a.id, a])), [accountsQuery.data])

  if (accountsQuery.isPending) return <FullScreenSpinner />
  if (accountsQuery.isError) return <QueryError onRetry={() => void accountsQuery.refetch()} />

  const accounts = accountsQuery.data
  const balances = balancesByCurrency(accounts)
  const summary = summarizeByCurrency(monthTx)
  const greeting = profile?.name ? t('home.greeting', { name: profile.name.split(' ')[0] }) : t('home.greetingNoName')

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>

      {accounts.filter((a) => !a.archived).length === 0 ? (
        <EmptyState icon={Wallet} title={t('accounts.empty')} description={t('accounts.emptyBody')}
          action={<Link to="/accounts" className="font-semibold text-primary">{t('accounts.new')}</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Link to="/accounts" className="rounded-3xl bg-primary p-5 text-primary-fg shadow-sm">
            <p className="text-sm opacity-80">{t('home.balance')}</p>
            {balances.map((b) => (
              <p key={b.currency} className="text-3xl font-bold tabular-nums">{formatMoney(b.total, b.currency, locale)}</p>
            ))}
          </Link>
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{t('home.thisMonth')}</p>
            {summary.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t('transactions.empty')}</p>
            ) : (
              summary.map((s) => (
                <dl key={s.currency} className="mt-2 grid grid-cols-2 gap-2">
                  <div><dt className="text-xs text-muted">{t('transactions.income_total')}</dt>
                    <dd className="font-semibold tabular-nums text-success">{formatMoney(s.income, s.currency, locale)}</dd></div>
                  <div><dt className="text-xs text-muted">{t('transactions.expense_total')}</dt>
                    <dd className="font-semibold tabular-nums text-danger">{formatMoney(s.expense, s.currency, locale)}</dd></div>
                </dl>
              ))
            )}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('home.recent')}</h2>
          <Link to="/transactions" className="inline-flex items-center gap-1 py-2 text-sm font-medium text-primary">
            {t('home.seeAll')} <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('transactions.emptyBody')}</p>
        ) : (
          <ul className="mt-2 rounded-2xl border border-line bg-surface p-1">
            {recent.slice(0, 5).map((tx) => (
              <li key={tx.id}>
                <TransactionRow transaction={tx} category={categoriesById.get(tx.category_id)}
                  account={accountsById.get(tx.account_id)} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
```

- [ ] **Step 3: Onboarding em 2 passos** — em `src/features/onboarding/OnboardingPage.tsx`:
  - Novo estado `step: 'preferences' | 'account'` (inicial `'preferences'`) e `accountCreated: boolean` (inicial `false`).
  - Passo 1 (formulário atual): o submit salva as preferências **sem** `onboarded_at` (`update.mutateAsync({ ...current, name: current.name.trim() })`) e então `setStep('account')`. O botão do passo 1 passa a usar `t('common.continue')`.
  - Mostrar acima do título um indicador `1/2 · {t('onboarding.stepPreferences')}` ou `2/2 · {t('onboarding.stepAccount')}` (`text-sm font-medium text-primary`).
  - Passo 2: título `t('onboarding.accountTitle')`, subtítulo `t('onboarding.accountSubtitle')`, e `<AccountForm initial={{ name: t('onboarding.defaultAccountName'), type: 'cash', currency: profile.currency, initial_balance: 0 }} currencyEditable submitLabel={t('onboarding.finish')} loading={createAccount.isPending || update.isPending} error={finishError ? t('common.errorGeneric') : null} onSubmit={(v) => void finish(v)}>` com um filho `<Button type="button" variant="ghost" full onClick={() => void finish(null)}>{t('common.skip')}</Button>`.
  - Função:

```tsx
async function finish(account: AccountInput | null) {
  setFinishError(false)
  try {
    if (account && !accountCreated) {
      await createAccount.mutateAsync(account)
      setAccountCreated(true)
    }
    await update.mutateAsync({ onboarded_at: new Date().toISOString() })
    navigate('/', { replace: true })
  } catch {
    setFinishError(true)
  }
}
```

  (`createAccount = useCreateAccount()`, `finishError` via `useState(false)`; imports de `AccountForm`, `useCreateAccount`, `type AccountInput`, `Button`.) Todos os hooks continuam antes dos `return` antecipados.

- [ ] **Step 4: Rotas** — `/` → `<HomePage />`, `/transactions` → `<TransactionsPage />`.

- [ ] **Step 5: Verificação**

Run: `npm test && npm run build && npm run e2e` → tudo verde (os testes E2E de visitante continuam válidos). Nunca deixar servidor rodando.

- [ ] **Step 6: Commit** — `feat: lista de lançamentos, início e primeira conta no onboarding`.

---

## Cobertura da especificação (Etapa 2)

| Requisito (spec) | Task |
|---|---|
| 3.3 Contas: tipos, saldo = inicial + receitas − despesas, arquivar | 1, 4, 6 |
| 3.4 Categorias padrão traduzidas + próprias (nome, ícone, cor, tipo) | 1, 3, 4, 5, 7 |
| 3.5 Lançamentos: dono, tipo, valor, data, categoria, descrição, conta; só o dono edita/exclui | 1, 4, 8 |
| 3.2 Moeda herdada da conta; totais separados por moeda | 1, 4, 6, 9 |
| 3.7 Competência de lançamento em conta = mês da data | 4 (`useTransactions` por mês), 9 |
| 4.1 Início: saldo das contas, gasto do mês, últimos lançamentos | 9 |
| 4.2 Lançamentos: lista por mês, filtros, busca, editar/excluir | 8, 9 |
| 4.3 Novo lançamento: teclado grande, tipo, categoria, conta, data; pré-preenche escolhas mais usadas | 5, 8 |
| 4.7 Mais/Configurações: contas e categorias | 6, 7 |
| 3.1 Assistente inicial pede a primeira conta | 9 |
| 6 Segurança: RLS + testes de que um usuário não acessa dados de outro | 1 |

Fora desta etapa: cartões/faturas/parcelas e Realtime (Etapa 3), recorrentes (4), grupos (5), orçamentos/metas/gráficos (6). A coluna `group_id` e o `card_id` entram nas migrations das etapas correspondentes.
