# Etapa 3 — Cartões, Faturas, Parcelas e Limite em Tempo Real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pessoa cadastra cartões (limite, fechamento, vencimento), lança compras à vista ou parceladas no cartão, vê faturas atuais/futuras/passadas com status, paga a fatura a partir de uma conta (liberando o limite) e vê o limite disponível atualizar na hora em todos os aparelhos; relatórios do mês passam a contar cada parcela no seu mês.

**Architecture:** Novas tabelas `cards`, `invoices`, `installments`; `transactions` ganha `card_id` e `installments_count` (origem: conta **ou** cartão). Gatilhos `security definer` geram parcelas e faturas a partir da compra; função RPC `pay_invoice`/`reopen_invoice`; views `card_limits`, `invoice_summaries`, `month_entries` (competência) e `account_balances` (agora descontando faturas pagas). Regras de fatura espelhadas em `src/lib/invoice.ts` (pré-visualização na UI) com testes. Supabase Realtime nas tabelas `transactions`, `invoices` e `cards` invalida o cache do TanStack Query.

**Tech Stack:** igual às etapas anteriores + Supabase Realtime (`supabase.channel().on('postgres_changes', …)`).

**Spec:** `docs/superpowers/specs/2026-10-10-app-financas-design.md` (3.6, 3.7, 4 item 4, 5, 7, 9.3). Design system: `DESIGN.md` (seguir tokens, tipografia e componentes existentes).

## Global Constraints

- Tudo das etapas anteriores: 4 idiomas com paridade de chaves; nenhum texto fixo; valores em centavos; RLS em toda tabela; commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `import type`; DESIGN.md manda no visual (folhas `rounded-[24px] bg-surface shadow-sheet`, pílulas, Manrope, `Amount` para dinheiro, `.num`).
- Dias de fechamento e vencimento: 1–28.
- Compra com dia **<** fechamento → fatura que fecha neste mês; dia **≥** fechamento → fatura do mês seguinte. Fatura identificada por `reference_month` (1º dia do mês em que fecha).
- `closing_date = reference_month + (closing_day − 1) dias`. Vencimento: se `due_day > closing_day`, mesmo mês do fechamento; senão mês seguinte, dia `due_day`.
- Parcelas: 1–48; `base = floor(valor/n)`, o resto vai na 1ª parcela; parcela k → fatura de `ref0 + (k−1) meses`; competência k → mês da compra + (k−1).
- Limite disponível = limite − soma das parcelas em faturas **não pagas**.
- Pagamento de fatura é integral, sai de uma conta da **mesma moeda** do cartão e **não** conta como despesa (só baixa o saldo da conta).
- Lançamento com parcela em fatura paga não pode ser editado nem excluído.
- Receita nunca vai para cartão.
- Moeda do cartão não muda depois de criado.
- Testes SQL rodam em transação desfeita (`begin … rollback`); `npm run test:db`.
- Implementadores **não** rodam `supabase db push`; o controlador aplica.

---

### Task 1: Banco — cartões, faturas, parcelas, competência, pagamento, Realtime + testes

**Files:**
- Create: `supabase/migrations/20261012000001_cards_invoices.sql`, `supabase/tests/03_cards.sql`

**Interfaces (produz):**
- `cards(id, user_id, name, limit_amount, closing_day, due_day, currency, color, archived, created_at, updated_at)`; cliente insere `name, limit_amount, closing_day, due_day, currency, color`; atualiza `name, limit_amount, closing_day, due_day, color, archived`.
- `transactions` + `card_id uuid null`, `installments_count smallint default 1`; cliente insere/atualiza também `card_id, installments_count`.
- `invoices(id, user_id, card_id, reference_month, closing_date, due_date, paid_at, payment_account_id, payment_amount, created_at)` — só leitura para o cliente.
- `installments(id, user_id, transaction_id, invoice_id, number, amount, competence_month)` — só leitura.
- RPC `pay_invoice(p_invoice uuid, p_account uuid) returns void`, `reopen_invoice(p_invoice uuid) returns void`.
- Views: `card_limits(card_id, user_id, currency, limit_amount, used, available)`, `invoice_summaries(id, user_id, card_id, reference_month, closing_date, due_date, paid_at, payment_account_id, payment_amount, currency, total, items)`, `month_entries(entry_id, transaction_id, user_id, kind, amount, currency, month, date, purchase_date, category_id, description, account_id, card_id, installment_number, installments_count, total_amount, created_at)`, `account_balances` (mesmas colunas, agora descontando faturas pagas).
- Erro de fatura paga: `errcode 23514`, `hint 'paid_invoice'`.

- [ ] **Step 1: Migration** `supabase/migrations/20261012000001_cards_invoices.sql`:

```sql
-- Etapa 3: cartões, faturas, parcelas, competência e pagamento de fatura

------------------------------------------------------------
-- Cartões
------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  limit_amount bigint not null check (limit_amount > 0 and limit_amount <= 99999999999),
  closing_day smallint not null check (closing_day between 1 and 28),
  due_day smallint not null check (due_day between 1 and 28),
  currency char(3) not null
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  color text not null default '#5b3df5' check (color ~ '^#[0-9a-f]{6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_user_idx on public.cards (user_id);

alter table public.cards enable row level security;
create policy cards_select_own on public.cards for select to authenticated using (user_id = (select auth.uid()));
create policy cards_insert_own on public.cards for insert to authenticated with check (user_id = (select auth.uid()));
create policy cards_update_own on public.cards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cards_delete_own on public.cards for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.cards from anon, authenticated;
grant select, delete on public.cards to authenticated;
grant insert (name, limit_amount, closing_day, due_day, currency, color) on public.cards to authenticated;
grant update (name, limit_amount, closing_day, due_day, color, archived) on public.cards to authenticated;

create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- Lançamentos: origem conta OU cartão, parcelas
------------------------------------------------------------
alter table public.transactions alter column account_id drop not null;
alter table public.transactions
  add column card_id uuid references public.cards (id) on delete no action deferrable initially deferred,
  add column installments_count smallint not null default 1 check (installments_count between 1 and 48);
alter table public.transactions
  add constraint transactions_one_source check ((account_id is null) <> (card_id is null)),
  add constraint transactions_card_is_expense check (card_id is null or kind = 'expense'),
  add constraint transactions_installments_need_card check (card_id is not null or installments_count = 1),
  add constraint transactions_installments_fit check (amount >= installments_count);
create index transactions_card_idx on public.transactions (card_id);

grant insert (card_id, installments_count), update (card_id, installments_count) on public.transactions to authenticated;

-- Validação: origem (conta ou cartão) e categoria do próprio usuário; moeda vem da origem.
create or replace function public.transactions_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src_user uuid;
  src_currency char(3);
  cat_user uuid;
  cat_kind text;
begin
  if new.account_id is not null then
    select a.user_id, a.currency into src_user, src_currency from public.accounts a where a.id = new.account_id;
  else
    select c.user_id, c.currency into src_user, src_currency from public.cards c where c.id = new.card_id;
  end if;
  if src_user is null or src_user <> new.user_id then
    raise exception 'origem inválida' using errcode = '23514';
  end if;

  select c.user_id, c.kind into cat_user, cat_kind from public.categories c where c.id = new.category_id;
  if cat_kind is null or (cat_user is not null and cat_user <> new.user_id) then
    raise exception 'categoria inválida' using errcode = '23514';
  end if;
  if cat_kind <> new.kind then
    raise exception 'tipo da categoria diferente do lançamento' using errcode = '23514';
  end if;

  new.currency := src_currency;
  return new;
end;
$$;

------------------------------------------------------------
-- Faturas e parcelas (escritas só pelos gatilhos/funções)
------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  reference_month date not null check (extract(day from reference_month) = 1),
  closing_date date not null,
  due_date date not null,
  paid_at timestamptz,
  payment_account_id uuid references public.accounts (id) on delete no action deferrable initially deferred,
  payment_amount bigint check (payment_amount >= 0),
  created_at timestamptz not null default now(),
  unique (card_id, reference_month),
  constraint invoices_payment_consistent check (
    (paid_at is null) = (payment_account_id is null) and (paid_at is null) = (payment_amount is null)
  )
);
create index invoices_user_idx on public.invoices (user_id);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  number smallint not null check (number >= 1),
  amount bigint not null check (amount > 0),
  competence_month date not null,
  unique (transaction_id, number)
);
create index installments_invoice_idx on public.installments (invoice_id);
create index installments_user_month_idx on public.installments (user_id, competence_month);

alter table public.invoices enable row level security;
alter table public.installments enable row level security;
create policy invoices_select_own on public.invoices for select to authenticated using (user_id = (select auth.uid()));
create policy installments_select_own on public.installments for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.invoices, public.installments from anon, authenticated;
grant select on public.invoices, public.installments to authenticated;

-- Garante a fatura (cartão + mês de referência) e devolve o id.
create function public.card_invoice_for(p_card uuid, p_ref date) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_id uuid;
begin
  select id, user_id, closing_day, due_day into c from public.cards where id = p_card;
  insert into public.invoices (user_id, card_id, reference_month, closing_date, due_date)
  values (
    c.user_id, c.id, p_ref,
    p_ref + (c.closing_day - 1),
    case when c.due_day > c.closing_day
      then p_ref + (c.due_day - 1)
      else (p_ref + interval '1 month')::date + (c.due_day - 1)
    end
  )
  on conflict (card_id, reference_month) do nothing;
  select id into v_id from public.invoices where card_id = p_card and reference_month = p_ref;
  return v_id;
end;
$$;
revoke execute on function public.card_invoice_for(uuid, date) from public, anon, authenticated;

-- Bloqueia alterar/excluir lançamento com parcela em fatura paga
-- (exceto quando o próprio usuário está sendo excluído, em cascata).
create function public.transactions_guard_paid() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id)
     and exists (
       select 1 from public.installments i join public.invoices v on v.id = i.invoice_id
       where i.transaction_id = old.id and v.paid_at is not null
     ) then
    raise exception 'lançamento em fatura paga' using errcode = '23514', hint = 'paid_invoice';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.transactions_guard_paid() from public, anon, authenticated;
create trigger transactions_guard_paid before update or delete on public.transactions
  for each row execute function public.transactions_guard_paid();

-- Gera as parcelas (e faturas) de uma compra no cartão.
create function public.transactions_sync_installments() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closing smallint;
  v_month0 date;
  v_ref0 date;
  v_base bigint;
  v_rest bigint;
  k int;
begin
  if tg_op = 'UPDATE' then
    delete from public.installments where transaction_id = new.id;
  end if;
  if new.card_id is null then
    return new;
  end if;

  select closing_day into v_closing from public.cards where id = new.card_id;
  v_month0 := date_trunc('month', new.date)::date;
  v_ref0 := case when extract(day from new.date) < v_closing then v_month0 else (v_month0 + interval '1 month')::date end;
  v_base := new.amount / new.installments_count;
  v_rest := new.amount - v_base * new.installments_count;

  for k in 1..new.installments_count loop
    insert into public.installments (user_id, transaction_id, invoice_id, number, amount, competence_month)
    values (
      new.user_id, new.id,
      public.card_invoice_for(new.card_id, (v_ref0 + make_interval(months => k - 1))::date),
      k,
      v_base + case when k = 1 then v_rest else 0 end,
      (v_month0 + make_interval(months => k - 1))::date
    );
  end loop;
  return new;
end;
$$;
revoke execute on function public.transactions_sync_installments() from public, anon, authenticated;
create trigger transactions_sync_installments after insert or update on public.transactions
  for each row execute function public.transactions_sync_installments();

------------------------------------------------------------
-- Pagar / desfazer pagamento de fatura
------------------------------------------------------------
create function public.pay_invoice(p_invoice uuid, p_account uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  a record;
  v_total bigint;
begin
  select i.id, i.user_id, i.paid_at, c.currency into v
    from public.invoices i join public.cards c on c.id = i.card_id where i.id = p_invoice;
  if v.id is null or v.user_id <> auth.uid() then
    raise exception 'fatura inválida' using errcode = '23514';
  end if;
  if v.paid_at is not null then
    raise exception 'fatura já paga' using errcode = '23514', hint = 'already_paid';
  end if;
  select id, user_id, currency into a from public.accounts where id = p_account;
  if a.id is null or a.user_id <> auth.uid() then
    raise exception 'conta inválida' using errcode = '23514';
  end if;
  if a.currency <> v.currency then
    raise exception 'moeda diferente' using errcode = '23514', hint = 'currency_mismatch';
  end if;
  select coalesce(sum(amount), 0) into v_total from public.installments where invoice_id = p_invoice;
  update public.invoices
    set paid_at = now(), payment_account_id = p_account, payment_amount = v_total
    where id = p_invoice;
end;
$$;

create function public.reopen_invoice(p_invoice uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invoices
    set paid_at = null, payment_account_id = null, payment_amount = null
    where id = p_invoice and user_id = auth.uid();
  if not found then
    raise exception 'fatura inválida' using errcode = '23514';
  end if;
end;
$$;

revoke execute on function public.pay_invoice(uuid, uuid), public.reopen_invoice(uuid) from public, anon;
grant execute on function public.pay_invoice(uuid, uuid), public.reopen_invoice(uuid) to authenticated;

------------------------------------------------------------
-- Views
------------------------------------------------------------
create view public.card_limits with (security_invoker = true) as
select
  c.id as card_id, c.user_id, c.currency, c.limit_amount,
  coalesce(sum(i.amount) filter (where v.paid_at is null), 0)::bigint as used,
  (c.limit_amount - coalesce(sum(i.amount) filter (where v.paid_at is null), 0))::bigint as available
from public.cards c
left join public.invoices v on v.card_id = c.id
left join public.installments i on i.invoice_id = v.id
group by c.id;

create view public.invoice_summaries with (security_invoker = true) as
select
  v.id, v.user_id, v.card_id, v.reference_month, v.closing_date, v.due_date,
  v.paid_at, v.payment_account_id, v.payment_amount, c.currency,
  coalesce(sum(i.amount), 0)::bigint as total,
  count(i.id)::int as items
from public.invoices v
join public.cards c on c.id = v.card_id
left join public.installments i on i.invoice_id = v.id
group by v.id, c.currency;

-- Competência: lançamentos em conta no mês da data; compras no cartão parcela a parcela.
create view public.month_entries with (security_invoker = true) as
select
  t.id as entry_id, t.id as transaction_id, t.user_id, t.kind, t.amount, t.currency,
  date_trunc('month', t.date)::date as month, t.date, t.date as purchase_date,
  t.category_id, t.description, t.account_id, t.card_id,
  1::smallint as installment_number, t.installments_count, t.amount as total_amount, t.created_at
from public.transactions t
where t.card_id is null
union all
select
  i.id, t.id, t.user_id, t.kind, i.amount, t.currency,
  i.competence_month, (t.date + make_interval(months => i.number - 1))::date, t.date,
  t.category_id, t.description, t.account_id, t.card_id,
  i.number, t.installments_count, t.amount, t.created_at
from public.installments i
join public.transactions t on t.id = i.transaction_id;

create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.currency,
  (a.initial_balance
    + coalesce((select sum(case when t.kind = 'income' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id), 0)
    - coalesce((select sum(v.payment_amount) from public.invoices v where v.payment_account_id = a.id), 0)
  )::bigint as balance
from public.accounts a;

revoke all on public.card_limits, public.invoice_summaries, public.month_entries from anon, authenticated;
grant select on public.card_limits, public.invoice_summaries, public.month_entries to authenticated;

------------------------------------------------------------
-- Realtime: limite e faturas atualizam ao vivo em todos os aparelhos
------------------------------------------------------------
alter publication supabase_realtime add table public.transactions, public.invoices, public.cards;
```

- [ ] **Step 2: Testes** `supabase/tests/03_cards.sql` (mesmo formato dos arquivos 01/02: `begin;` … asserções em blocos `do $$` que fazem `raise exception 'FAIL: …'` … `rollback;` e por fim `select 'PASS' as result;`). Usar usuários `rls-card-a@test.invalid` (`…0a3`) e `rls-card-b@test.invalid` (`…0b3`), tabela temporária `ids` com `grant all … to authenticated` como em 02. Cobrir, com estes números exatos:

  - **A** (claims do usuário A): cria conta BRL `Banco A` saldo inicial 100000; cartão BRL limite 500000, fechamento 10, vencimento 17; obtém `sys_food`.
  - Compra 1: `expense`, 30000, data `'2026-03-05'`, `installments_count` 3, cartão → existem 3 parcelas `10000/10000/10000`; faturas com `reference_month` `2026-03-01`, `2026-04-01`, `2026-05-01`; a de março tem `closing_date 2026-03-10` e `due_date 2026-03-17`.
  - Compra 2: 1000, data `'2026-03-10'` (dia = fechamento), à vista → parcela na fatura de `2026-04-01`.
  - Compra 3: 1001, 2x, data `'2026-03-01'` → parcelas `501` e `500`.
  - `card_limits.used = 32001` e `available = 467999`.
  - `month_entries` do usuário com `month = '2026-04-01'` soma `10000 + 500` (parcela 2 da compra 1, parcela 2 da compra 3) → `10500`; a compra 2 (data 10/03) conta em março (competência = mês da compra).
  - Receita no cartão (`kind income`, categoria `salary`, `card_id`) → `check_violation`.
  - Cartão com vencimento ≤ fechamento: cartão 2 fechamento 25, vencimento 5; compra em `'2026-03-26'` → fatura `reference_month 2026-04-01`, `closing_date 2026-04-25`, `due_date 2026-05-05`.
  - `pay_invoice(fatura de março do cartão 1, conta A)` → `paid_at` preenchido, `payment_amount = 10000 + 501` (parcela 1 da compra 1 e parcela 1 da compra 3); `card_limits.available` sobe 10501; `account_balances.balance` da conta A = `100000 − 10501`.
  - Atualizar a compra 1 (descrição) → `check_violation` (fatura paga); excluir a compra 1 → `check_violation`.
  - `pay_invoice` de novo na mesma fatura → `check_violation`.
  - Conta EUR pagando fatura BRL (criar conta EUR) → `check_violation`.
  - `reopen_invoice` → `paid_at` nulo e limite volta.
  - Atualizar `currency` do cartão → `insufficient_privilege`. Inserir diretamente em `invoices` → `insufficient_privilege`.
  - **B** (claims do usuário B): não vê cartões, faturas, parcelas, `card_limits`, `invoice_summaries`, `month_entries` de A (contagens 0); `pay_invoice` numa fatura de A → `check_violation`; lançar no cartão de A → `check_violation`.
  - **Exclusão do usuário A** (após `reset role`, com uma fatura paga de novo): `delete from auth.users where id = A; set constraints all immediate;` sem erro, e não restam `cards`/`invoices`/`installments` de A.
  - **anon**: `select` em `cards`, `invoices`, `installments`, `card_limits` → `insufficient_privilege` cada.

- [ ] **Step 3:** `npm test` e `npm run build` verdes; commit. **Não** rodar `db push`/`test:db` (o controlador faz um dry-run em transação com `supabase db query --linked`, aplica e roda `npm run test:db`).

---

### Task 2: Regras de fatura no cliente (TDD)

**Files:** Create `src/lib/invoice.ts`, `src/lib/invoice.test.ts`

**Interfaces (produz):**
- `invoiceMonthFor(dateISO: string, closingDay: number): string` → `'YYYY-MM'`
- `closingDateOf(month: string, closingDay: number): string`; `dueDateOf(month: string, closingDay: number, dueDay: number): string`
- `splitInstallments(amount: number, n: number): number[]`
- `type ScheduleItem = { number: number; amount: number; invoiceMonth: string; competenceMonth: string }`; `installmentSchedule(dateISO: string, amount: number, n: number, closingDay: number): ScheduleItem[]`
- `type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue'`; `invoiceStatus(inv: { paid_at: string | null; closing_date: string; due_date: string }, today: string): InvoiceStatus` — `paid` se pago; `open` se `today < closing_date`; `overdue` se `today > due_date`; senão `closed`.

- [ ] **Step 1: Testes (falham)** `src/lib/invoice.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { closingDateOf, dueDateOf, installmentSchedule, invoiceMonthFor, invoiceStatus, splitInstallments } from './invoice'

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
```

- [ ] **Step 2: Implementar** `src/lib/invoice.ts` (reusar `shiftMonth` de `./dates`; datas como texto local):

```ts
import { shiftMonth } from './dates'

const pad = (n: number) => String(n).padStart(2, '0')

export function invoiceMonthFor(dateISO: string, closingDay: number): string {
  const month = dateISO.slice(0, 7)
  const day = Number(dateISO.slice(8, 10))
  return day < closingDay ? month : shiftMonth(month, 1)
}

export function closingDateOf(month: string, closingDay: number): string {
  return `${month}-${pad(closingDay)}`
}

export function dueDateOf(month: string, closingDay: number, dueDay: number): string {
  const dueMonth = dueDay > closingDay ? month : shiftMonth(month, 1)
  return `${dueMonth}-${pad(dueDay)}`
}

export function splitInstallments(amount: number, n: number): number[] {
  const base = Math.floor(amount / n)
  const rest = amount - base * n
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? rest : 0))
}

export type ScheduleItem = { number: number; amount: number; invoiceMonth: string; competenceMonth: string }

export function installmentSchedule(dateISO: string, amount: number, n: number, closingDay: number): ScheduleItem[] {
  const first = invoiceMonthFor(dateISO, closingDay)
  const purchaseMonth = dateISO.slice(0, 7)
  return splitInstallments(amount, n).map((value, i) => ({
    number: i + 1,
    amount: value,
    invoiceMonth: shiftMonth(first, i),
    competenceMonth: shiftMonth(purchaseMonth, i),
  }))
}

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue'

export function invoiceStatus(inv: { paid_at: string | null; closing_date: string; due_date: string }, today: string): InvoiceStatus {
  if (inv.paid_at) return 'paid'
  if (today < inv.closing_date) return 'open'
  if (today > inv.due_date) return 'overdue'
  return 'closed'
}
```

- [ ] **Step 3:** `npm test` (RED antes, GREEN depois) e `npm run build`; commit `feat: regras de fatura e parcelas no cliente`.

---

### Task 3: Traduções da Etapa 3

**Files:** Modify `src/i18n/locales/{pt-BR,pt-PT,en,es}.json`

- [ ] **Step 1: pt-BR** (mesclar; não remover chaves):

```json
{
  "cards": {
    "title": "Cartões", "new": "Novo cartão", "edit": "Editar cartão", "name": "Nome do cartão",
    "limit": "Limite", "invalidLimit": "Informe um limite maior que zero.",
    "closingDay": "Dia de fechamento", "dueDay": "Dia de vencimento", "dayHint": "Use um dia de 1 a 28.",
    "color": "Cor", "available": "Disponível", "used": "Usado", "ofLimit": "de {{limit}}",
    "closesOn": "Fecha dia {{day}}", "dueOn": "Vence dia {{day}}",
    "currentInvoice": "Fatura atual", "nextDue": "Próximo vencimento",
    "empty": "Nenhum cartão ainda",
    "emptyBody": "Cadastre seus cartões para acompanhar faturas, parcelas e o limite disponível.",
    "archivedSection": "Cartões arquivados",
    "deleteBlocked": "Este cartão tem lançamentos. Arquive-o em vez de excluir."
  },
  "invoices": {
    "title": "Faturas", "total": "Total da fatura", "items": "Compras",
    "status": { "open": "Aberta", "closed": "Fechada", "paid": "Paga", "overdue": "Vencida" },
    "closes": "Fecha em {{date}}", "due": "Vence em {{date}}", "paidOn": "Paga em {{date}}",
    "pay": "Pagar fatura", "payTitle": "Pagar fatura de {{month}}", "payFrom": "Pagar com a conta",
    "payConfirm": "Confirmar pagamento",
    "noAccountInCurrency": "Você não tem conta em {{currency}} para pagar esta fatura.",
    "reopen": "Desfazer pagamento", "empty": "Nenhuma compra nesta fatura.",
    "installment": "Parcela {{n}} de {{total}}"
  },
  "transactions": {
    "source": "Pagar com", "sourceAccount": "Conta", "sourceCard": "Cartão", "card": "Cartão",
    "installments": "Parcelas", "inCash": "À vista", "installmentsOption": "{{count}}x de {{amount}}",
    "firstInvoice": "A primeira parcela cai na fatura de {{month}}.",
    "installmentBadge": "{{n}}/{{total}}",
    "paidLocked": "Este lançamento está numa fatura paga e não pode ser alterado. Desfaça o pagamento da fatura para editar."
  },
  "home": { "cards": "Seus cartões", "availableLimit": "Limite disponível" }
}
```
e dentro de `transactions.errors`: `"card": "Escolha um cartão."`.

- [ ] **Step 2: en** (mesmas chaves): cards → "Cards", "New card", "Edit card", "Card name", "Limit", "Enter a limit greater than zero.", "Closing day", "Due day", "Use a day from 1 to 28.", "Color", "Available", "Used", "of {{limit}}", "Closes on the {{day}}", "Due on the {{day}}", "Current bill", "Next due date", "No cards yet", "Add your cards to follow bills, installments and your available limit.", "Archived cards", "This card has transactions. Archive it instead of deleting."; invoices → "Bills", "Bill total", "Purchases", status "Open"/"Closed"/"Paid"/"Overdue", "Closes {{date}}", "Due {{date}}", "Paid {{date}}", "Pay bill", "Pay {{month}} bill", "Pay from account", "Confirm payment", "You have no {{currency}} account to pay this bill.", "Undo payment", "No purchases in this bill.", "Installment {{n}} of {{total}}"; transactions → "Pay with", "Account", "Card", "Card", "Installments", "Pay in full", "{{count}}x of {{amount}}", "The first installment goes on the {{month}} bill.", "{{n}}/{{total}}", "This transaction is on a paid bill and can't be changed. Undo the bill payment to edit it.", errors.card "Choose a card."; home → "Your cards", "Available limit".

- [ ] **Step 3: pt-PT e es** traduzidos seguindo o padrão dos arquivos (pt-PT: "Cartões", "Extrato"/"Fatura" → usar **"Extrato do cartão"** para *bill*/fatura e "Pagar extrato"; "Limite", "Dia de fecho", "Dia de pagamento", "Prestações" para parcelas, "A pronto" para à vista; es: "Tarjetas", "Resumen"/"Factura" → usar **"Resumen"** para fatura, "Pagar resumen", "Cuotas", "En un pago", "Día de cierre", "Día de vencimiento"). `{{…}}` idênticos nos 4.

- [ ] **Step 4:** `npm test` (paridade) e commit `feat(i18n): textos da etapa 3`.

---

### Task 4: Camada de dados — cartões, faturas, competência e tempo real

**Files:**
- Create: `src/features/cards/types.ts`, `src/features/cards/api.ts`, `src/features/cards/invoicesApi.ts`, `src/lib/realtime.ts`
- Modify: `src/features/transactions/types.ts`, `src/features/transactions/api.ts`, `src/app/AppShell.tsx` (montar `useRealtimeSync()`), `src/lib/db-errors.ts` (+ `isPaidInvoiceError`) e teste

**Interfaces (produz):**
- `type Card = { id; user_id; name; limit_amount: number; closing_day: number; due_day: number; currency: CurrencyCode; color: string; archived: boolean; created_at; updated_at }`; `type CardWithLimit = Card & { used: number; available: number }`; `type CardInput = Pick<Card, 'name'|'limit_amount'|'closing_day'|'due_day'|'currency'|'color'>`; `type CardPatch = Partial<Pick<Card, 'name'|'limit_amount'|'closing_day'|'due_day'|'color'|'archived'>>`
- `useCards(): CardWithLimit[]` (cards + `card_limits`, key `['cards', uid]`), `useCreateCard`, `useUpdateCard({id, patch})`, `useDeleteCard(id)` — invalidam `['cards']`.
- `type InvoiceSummary = { id; card_id; reference_month: string; closing_date: string; due_date: string; paid_at: string|null; payment_account_id: string|null; payment_amount: number|null; currency: CurrencyCode; total: number; items: number }`
- `useCardInvoices(cardId)` → `InvoiceSummary[]` ordenadas por `reference_month` (key `['invoices', uid, cardId]`); `useAllOpenInvoices()` → faturas não pagas de todos os cartões (key `['invoices', uid, 'unpaid']`) para o Início.
- `type InvoiceItem = { id: string; number: number; amount: number; transaction: { id: string; description: string; category_id: string; installments_count: number; date: string; amount: number } }`; `useInvoiceItems(invoiceId)` → select `id, number, amount, transaction:transactions(id, description, category_id, installments_count, date, amount)` filtrando `invoice_id`.
- `usePayInvoice()` (arg `{ invoiceId, accountId }` → `supabase.rpc('pay_invoice', { p_invoice, p_account })`), `useReopenInvoice()` (arg `invoiceId`) — ambos invalidam `['invoices']`, `['cards']`, `['accounts']`.
- `Transaction` ganha `account_id: string | null`, `card_id: string | null`, `installments_count: number`; `TransactionInput` ganha `card_id`, `installments_count` (com `account_id` ou `card_id` nulo).
- `type MonthEntry = Transaction & { entry_id: string; transaction_id: string; installment_number: number; total_amount: number; purchase_date: string }` — `id` = `transaction_id`, `amount` = valor da parcela, `date` = data da entrada.
- `useTransactions(month)` passa a ler **`month_entries`** com `month = '<YYYY-MM>-01'`, ordenado por `date desc, created_at desc`, e devolve `MonthEntry[]` (mapear `id: transaction_id`). Chaves de React nas listas usam `entry_id`.
- Mutações de lançamento também invalidam `['cards']` e `['invoices']`.
- `useRealtimeSync()`: com usuário logado, abre **um** canal `finance-<uid>` com `postgres_changes` (`event: '*'`, `schema: 'public'`) para `transactions`, `invoices` e `cards` filtrando `user_id=eq.<uid>`; qualquer evento invalida `['transactions']`, `['accounts']`, `['cards']`, `['invoices']`; remove o canal ao desmontar/trocar de usuário.
- `isPaidInvoiceError(e)` → `true` quando `code === '23514'` e `hint === 'paid_invoice'` (teste unitário).

- [ ] Implementar seguindo o padrão de `src/features/accounts/api.ts`; ajustar `filters.ts`/`defaults.ts`/consumidores para `account_id` anulável (TypeScript deve compilar: `pickDefaults` ignora lançamentos sem conta; `TransactionRow` recebe `card?: Card` além de `account?`). Atualizar testes existentes afetados. `npm test`, `npm run build`, commit.

---

### Task 5: Tela de cartões (lista + formulário)

**Files:** Create `src/features/cards/CardForm.tsx`, `src/features/cards/CardsPage.tsx`, `src/features/cards/CardTile.tsx`; Modify `src/app/router.tsx` (`/cards` → `CardsPage`), `src/app/nav.ts`

**Comportamento:**
- `CardTile` — o cartão como objeto: retângulo `aspect-[1.586] rounded-[22px]` na cor do cartão (fundo `color` com o motivo de dois círculos da marca em branco translúcido no canto, igual ao `.brand-panel`), nome, moeda, "Fecha dia X · Vence dia Y"; abaixo do tile, barra de limite (usado/disponível) e `Amount` do disponível "de {{limit}}". Clique leva a `/cards/:id`.
- `CardsPage` — título, botão "Novo cartão", grade (`sm:grid-cols-2`) de `CardTile`s ativos, `EmptyState` quando vazio, `<details>` com arquivados, `Sheet` com `CardForm` para criar.
- `CardForm` — nome; limite (texto, `parseAmount`, erro `cards.invalidLimit`); dia de fechamento e de vencimento (`SelectField` 1–28, dica `cards.dayHint`); moeda (só ao criar); cor (radios de `CATEGORY_COLORS` + `#5b3df5` primeiro, com check e foco visível como `CategoryForm`). Em edição: arquivar/desarquivar e excluir com confirmação (bloqueio `cards.deleteBlocked` por `isForeignKeyViolation`), mesma robustez de `AccountsPage` (`busy`, reset de erro/confirmação).
- Navegação: `NAV_ITEMS` = Início, Lançamentos, + , **Cartões** (`CreditCard`), Contas. Categorias continua no menu lateral do PC (adicionar um item extra só no sidebar: `{ to: '/categories', …, sidebarOnly: true }`), nos atalhos do Início e em Configurações.

- [ ] Implementar, `npm test`, `npm run build`, commit.

---

### Task 6: Detalhe do cartão, faturas e pagamento

**Files:** Create `src/features/cards/CardDetailPage.tsx`, `src/features/cards/PayInvoiceSheet.tsx`; Modify `src/app/router.tsx` (`/cards/:id`)

**Comportamento:**
- Cabeçalho: `CardTile` grande + limite (usado, disponível, barra) e ações "Editar" (abre `Sheet` com `CardForm`).
- Faturas: faixa horizontal rolável de pílulas por mês (`formatMonth` curto) com status colorido (`invoiceStatus` + `todayISO`): paga = verde, vencida = vermelho, fechada = âmbar suave (`text-fg` + ponto), aberta = primária. Seleciona por padrão a primeira não paga com `closing_date >= hoje`, senão a última.
- Fatura selecionada (folha): status, total grande (`Amount`), "Fecha em …"/"Vence em …" (`Intl.DateTimeFormat` com `day` e `month` longos), lista de itens (`useInvoiceItems`) com `CategoryIcon`, descrição/categoria e selo `transactions.installmentBadge` quando `installments_count > 1`; link de cada item para `/transactions/:id/edit`. Vazia → `invoices.empty`.
- Ação: não paga → "Pagar fatura" (abre `PayInvoiceSheet`): `SelectField` com contas ativas na moeda do cartão (se nenhuma: mensagem `invoices.noAccountInCurrency` e link para `/accounts`), total a pagar e "Confirmar pagamento" (`usePayInvoice`). Paga → "Paga em …" + botão secundário "Desfazer pagamento" (`useReopenInvoice`).
- Estados de carregamento/erro com `Spinner`/`QueryError`; cartão inexistente → volta para `/cards`.

- [ ] Implementar, `npm test`, `npm run build`, commit.

---

### Task 7: Lançar no cartão, parcelas na lista e cartões no Início

**Files:** Modify `src/features/transactions/TransactionFormPage.tsx`, `src/features/transactions/TransactionRow.tsx`, `src/features/transactions/TransactionsPage.tsx`, `src/features/home/HomePage.tsx`

**Comportamento:**
- Formulário: abaixo da categoria, `SegmentedControl` "Pagar com": Conta | Cartão (só para despesa; receita força Conta e esconde o controle). Cartão → `SelectField` de cartões ativos (+ o atual em edição) e `SelectField` de parcelas: "À vista" e `2x…48x` com rótulo `transactions.installmentsOption` (valor da parcela calculado por `splitInstallments`, primeira parcela); abaixo, a dica `transactions.firstInvoice` com o mês de `invoiceMonthFor(data, closing_day)` (`formatMonth`). A moeda do teclado segue o cartão. Validação `transactions.errors.card`. Payload: conta → `{ account_id, card_id: null, installments_count: 1 }`; cartão → `{ account_id: null, card_id, installments_count }`. Padrões: `pickDefaults` continua sugerindo conta; se o último lançamento de despesa foi no cartão, começar em "Cartão" com esse cartão.
- Edição de lançamento com parcela em fatura paga: ao salvar/excluir, erro `isPaidInvoiceError` → mostrar `transactions.paidLocked` (não o erro genérico).
- `TransactionRow`: subtítulo mostra o nome do cartão quando `card_id`; selo pílula pequeno `n/total` quando a entrada é parcela (`installments_count > 1`), usando `installment_number` quando existir.
- `TransactionsPage`: lista e resumo usam as entradas de competência (`useTransactions` já devolve `MonthEntry[]`); filtro "conta" passa a listar contas **e** cartões (`<optgroup>`s), filtrando por `account_id` ou `card_id`.
- Início: nova folha "Seus cartões" (entre "Este mês"/categorias e os últimos lançamentos; no PC ocupa a coluna esquerda abaixo das categorias) com cada cartão ativo: mini `CardTile` compacto (bolinha da cor + nome), disponível (`Amount`) com barra, e a fatura atual (total + status + vencimento) via `useAllOpenInvoices`; link para `/cards/:id`. Sem cartões → não mostrar a folha.
- [ ] Rodar `npm test`, `npm run build`, `npm run e2e`; commit.

## Cobertura da especificação (Etapa 3)

| Requisito | Task |
|---|---|
| 3.6 Cartão: limite, fechamento, vencimento, moeda, cor | 1, 5 |
| 3.6 Fatura por mês de referência, regra do fechamento, vencimento | 1, 2, 6 |
| 3.6 Parcelamento 1–48, resto na 1ª | 1, 2, 7 |
| 3.6 Limite disponível = limite − parcelas não pagas | 1, 4, 5 |
| 3.6 Pagar fatura integral de uma conta; não conta como despesa | 1, 6 |
| 3.6 Estados aberta/fechada/paga/vencida | 2, 6 |
| 3.6 Bloqueio de edição em fatura paga | 1, 7 |
| 3.7 Competência por parcela | 1, 4, 7 |
| 4.4 Tela de cartões e faturas | 5, 6 |
| 7 Realtime: limite e saldos atualizam ao vivo | 1, 4 |
| 4.1 Início mostra cartões e próximas faturas | 7 |

Fora desta etapa: cartão no assistente inicial (o cadastro fica na tela de cartões, com estado vazio que convida a criar), recorrentes (Etapa 4), grupos (5).
