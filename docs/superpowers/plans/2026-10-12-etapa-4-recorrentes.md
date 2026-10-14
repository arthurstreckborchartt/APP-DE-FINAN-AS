# Etapa 4 — Contas Recorrentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pessoa cadastra receitas e despesas que se repetem (salário, aluguel, assinaturas) com frequência semanal, mensal ou anual, a partir de uma conta ou de um cartão; o app gera os lançamentos sozinho (todo dia pelo servidor e também ao abrir o app), nunca em dobro; dá para pausar, retomar, editar (vale para as próximas) e excluir; o Início mostra os próximos vencimentos (recorrentes + faturas).

**Architecture:** Tabela `recurring` com RLS e o mesmo tipo de validação dos lançamentos; `next_date` controla a próxima ocorrência; função `recurring_next()` calcula a data seguinte ancorada na data de início (dia do mês "grudado" no fim do mês quando não existe); `generate_recurring_for(user, até)` (security definer) cria os lançamentos com `recurring_id` + `recurring_date` únicos; `generate_my_recurring()` (RPC) para o app chamar ao abrir/criar; `pg_cron` roda tudo diariamente. Regras espelhadas em `src/lib/recurrence.ts` (próximas datas na UI) com testes.

**Spec:** `docs/superpowers/specs/2026-10-10-app-financas-design.md` §3.8, §4.1 ("próximas contas a vencer"), §4.7, §9.4. Design: `DESIGN.md`.

## Global Constraints

- Tudo das etapas anteriores (4 idiomas com paridade, centavos, RLS, `Amount` para dinheiro e respeito a "ocultar valores", DESIGN.md, `import type`, commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Frequências: `weekly | monthly | yearly`. Âncora = `start_date`. Mensal: mesmo dia da âncora; se o mês não tem esse dia, usa o último dia do mês (31/jan → 28/fev → 31/mar). Anual: mesmo dia/mês da âncora, com o mesmo ajuste (29/fev → 28/fev em anos comuns). Semanal: +7 dias.
- Receita só em conta; recorrente no cartão gera compra à vista (1 parcela).
- Cada ocorrência gera no máximo um lançamento (`unique (recurring_id, recurring_date)`).
- Editar uma recorrente não altera lançamentos já gerados; `kind` e `start_date` não são editáveis (para mudar, cria-se outra).
- Se a conta/cartão de origem estiver arquivada na hora de gerar, a recorrente é pausada automaticamente.
- Excluir a recorrente mantém os lançamentos já gerados (`on delete set null`).
- Geração diária às 03:15 UTC via `pg_cron` (já disponível no projeto) usando `current_date`.
- Implementadores não rodam `db push`; o controlador faz dry-run em transação, aplica e roda `npm run test:db`.

---

### Task 1: Banco — recorrentes, geração, cron + testes

**Files:** Create `supabase/migrations/20261013000001_recurring.sql`, `supabase/tests/04_recurring.sql`

**Interfaces (produz):**
- `recurring(id, user_id, kind, amount, currency, category_id, description, account_id, card_id, frequency, start_date, end_date, next_date, paused, created_at, updated_at)`; cliente insere `kind, amount, category_id, description, account_id, card_id, frequency, start_date, end_date`; atualiza `amount, category_id, description, account_id, card_id, frequency, end_date, paused`.
- `transactions.recurring_id uuid null`, `transactions.recurring_date date null` (não graváveis pelo cliente).
- `month_entries` ganha a coluna `recurring_id` (no fim).
- RPC `generate_my_recurring() returns integer` (quantos lançamentos criou).
- Função interna `generate_recurring_for(p_user uuid, p_until date) returns integer`; `recurring_next(p_date date, p_frequency text, p_anchor date) returns date` (imutável, executável por todos).

- [ ] **Step 1: Migration** (escrever exatamente; corrigir só bugs encontrados no dry-run, registrando no relatório):

```sql
-- Etapa 4: contas recorrentes

create extension if not exists pg_cron;

------------------------------------------------------------
-- Próxima data de uma recorrência, ancorada na data de início
------------------------------------------------------------
create function public.recurring_next(p_date date, p_frequency text, p_anchor date) returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first date;
  v_last_day int;
  v_day int := extract(day from p_anchor)::int;
begin
  if p_frequency = 'weekly' then
    return p_date + 7;
  elsif p_frequency = 'monthly' then
    v_first := (date_trunc('month', p_date) + interval '1 month')::date;
  elsif p_frequency = 'yearly' then
    v_first := make_date(extract(year from p_date)::int + 1, extract(month from p_anchor)::int, 1);
  else
    raise exception 'frequência inválida' using errcode = '23514';
  end if;
  v_last_day := extract(day from (v_first + interval '1 month' - interval '1 day'))::int;
  return v_first + (least(v_day, v_last_day) - 1);
end;
$$;

------------------------------------------------------------
-- Recorrentes
------------------------------------------------------------
create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount bigint not null check (amount > 0 and amount <= 99999999999),
  currency char(3) not null,
  category_id uuid not null references public.categories (id) on delete no action deferrable initially deferred,
  description text not null default '' check (char_length(description) <= 140),
  account_id uuid references public.accounts (id) on delete no action deferrable initially deferred,
  card_id uuid references public.cards (id) on delete no action deferrable initially deferred,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null check (start_date between '2000-01-01' and '2100-12-31'),
  end_date date check (end_date is null or end_date >= start_date),
  next_date date not null,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_one_source check ((account_id is null) <> (card_id is null)),
  constraint recurring_card_is_expense check (card_id is null or kind = 'expense')
);
create index recurring_user_idx on public.recurring (user_id);
create index recurring_due_idx on public.recurring (next_date) where not paused;

alter table public.recurring enable row level security;
create policy recurring_select_own on public.recurring for select to authenticated using (user_id = (select auth.uid()));
create policy recurring_insert_own on public.recurring for insert to authenticated with check (user_id = (select auth.uid()));
create policy recurring_update_own on public.recurring for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recurring_delete_own on public.recurring for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.recurring from anon, authenticated;
grant select, delete on public.recurring to authenticated;
grant insert (kind, amount, category_id, description, account_id, card_id, frequency, start_date, end_date)
  on public.recurring to authenticated;
grant update (amount, category_id, description, account_id, card_id, frequency, end_date, paused)
  on public.recurring to authenticated;

create trigger recurring_set_updated_at before update on public.recurring
  for each row execute function public.set_updated_at();

-- Validação (como nos lançamentos): origem e categoria do próprio usuário, moeda da origem,
-- origem arquivada não aceita; next_date começa na data de início.
create function public.recurring_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src_user uuid;
  src_currency char(3);
  src_archived boolean;
  cat_user uuid;
  cat_kind text;
begin
  if new.account_id is not null then
    select a.user_id, a.currency, a.archived into src_user, src_currency, src_archived
      from public.accounts a where a.id = new.account_id;
  else
    select c.user_id, c.currency, c.archived into src_user, src_currency, src_archived
      from public.cards c where c.id = new.card_id;
  end if;
  if src_user is null or src_user <> new.user_id then
    raise exception 'origem inválida' using errcode = '23514';
  end if;
  if src_archived and (tg_op = 'INSERT'
      or new.account_id is distinct from old.account_id
      or new.card_id is distinct from old.card_id) then
    raise exception 'origem arquivada' using errcode = '23514', hint = 'archived_source';
  end if;

  select c.user_id, c.kind into cat_user, cat_kind from public.categories c where c.id = new.category_id;
  if cat_kind is null or (cat_user is not null and cat_user <> new.user_id) then
    raise exception 'categoria inválida' using errcode = '23514';
  end if;
  if cat_kind <> new.kind then
    raise exception 'tipo da categoria diferente' using errcode = '23514';
  end if;

  new.currency := src_currency;
  if tg_op = 'INSERT' then
    new.next_date := new.start_date;
  end if;
  return new;
end;
$$;
create trigger recurring_validate before insert or update on public.recurring
  for each row execute function public.recurring_validate();

------------------------------------------------------------
-- Lançamentos gerados
------------------------------------------------------------
alter table public.transactions
  add column recurring_id uuid references public.recurring (id) on delete set null,
  add column recurring_date date;
create unique index transactions_recurring_once on public.transactions (recurring_id, recurring_date)
  where recurring_id is not null;

-- Gera as ocorrências vencidas (até p_until) das recorrentes ativas de um usuário (ou de todos, se nulo).
create function public.generate_recurring_for(p_user uuid, p_until date) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next date;
  v_archived boolean;
  v_created integer := 0;
  v_guard integer;
begin
  for r in
    select * from public.recurring
    where not paused and next_date <= p_until and (p_user is null or user_id = p_user)
    for update skip locked
  loop
    if r.account_id is not null then
      select archived into v_archived from public.accounts where id = r.account_id;
    else
      select archived into v_archived from public.cards where id = r.card_id;
    end if;
    if v_archived then
      update public.recurring set paused = true where id = r.id;
      continue;
    end if;

    v_next := r.next_date;
    v_guard := 0;
    while v_next <= p_until and (r.end_date is null or v_next <= r.end_date) and v_guard < 500 loop
      insert into public.transactions
        (user_id, kind, amount, date, category_id, description, account_id, card_id, installments_count,
         recurring_id, recurring_date)
      values
        (r.user_id, r.kind, r.amount, v_next, r.category_id, r.description, r.account_id, r.card_id, 1,
         r.id, v_next)
      on conflict (recurring_id, recurring_date) where recurring_id is not null do nothing;
      if found then
        v_created := v_created + 1;
      end if;
      v_next := public.recurring_next(v_next, r.frequency, r.start_date);
      v_guard := v_guard + 1;
    end loop;

    update public.recurring set next_date = v_next where id = r.id;
  end loop;
  return v_created;
end;
$$;
revoke execute on function public.generate_recurring_for(uuid, date) from public, anon, authenticated;

create function public.generate_my_recurring() returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sem usuário' using errcode = '42501';
  end if;
  return public.generate_recurring_for(auth.uid(), current_date);
end;
$$;
revoke execute on function public.generate_my_recurring() from public, anon;
grant execute on function public.generate_my_recurring() to authenticated;

------------------------------------------------------------
-- Competência: expõe recurring_id
------------------------------------------------------------
create or replace view public.month_entries with (security_invoker = true) as
select
  t.id as entry_id, t.id as transaction_id, t.user_id, t.kind, t.amount, t.currency,
  date_trunc('month', t.date)::date as month, t.date, t.date as purchase_date,
  t.category_id, t.description, t.account_id, t.card_id,
  1::smallint as installment_number, t.installments_count, t.amount as total_amount, t.created_at,
  t.recurring_id
from public.transactions t
where t.card_id is null
union all
select
  i.id, t.id, t.user_id, t.kind, i.amount, t.currency,
  i.competence_month, (t.date + make_interval(months => i.number - 1))::date, t.date,
  t.category_id, t.description, t.account_id, t.card_id,
  i.number, t.installments_count, t.amount, t.created_at,
  t.recurring_id
from public.installments i
join public.transactions t on t.id = i.transaction_id;

------------------------------------------------------------
-- Tempo real e agendamento diário
------------------------------------------------------------
alter publication supabase_realtime add table public.recurring;

select cron.schedule(
  'finance-recorrentes-diarias',
  '15 3 * * *',
  $$select public.generate_recurring_for(null, current_date)$$
);
```

- [ ] **Step 2: Testes** `supabase/tests/04_recurring.sql` (mesmo formato de 02/03; usuários `rls-rec-a@test.invalid` `…0a4` e `rls-rec-b@test.invalid` `…0b4`; tabela temporária `ids`). Cobrir com números exatos:
  - `recurring_next`: `('2026-01-31','monthly','2026-01-31')` → `2026-02-28`; `('2026-02-28','monthly','2026-01-31')` → `2026-03-31`; `('2026-03-10','weekly','2026-03-10')` → `2026-03-17`; `('2024-02-29','yearly','2024-02-29')` → `2025-02-28`; `('2025-02-28','yearly','2024-02-29')` → `2026-02-28`.
  - A cria conta BRL (saldo 0) e recorrente mensal de despesa 5000 (categoria `housing`), início `2026-01-31`, sem fim → `next_date = 2026-01-31`, `currency = 'BRL'`.
  - Como postgres (`reset role`): `generate_recurring_for(A, '2026-04-15')` retorna 3 e cria lançamentos em `2026-01-31`, `2026-02-28`, `2026-03-31`; `next_date` vira `2026-04-30`. Chamar de novo com a mesma data retorna 0 (sem duplicar).
  - Recorrente semanal de receita com `end_date = start_date + 14` (início `2026-03-02`) gera exatamente 3 ocorrências até `2026-12-31`.
  - Recorrente no cartão (cartão BRL fechamento 10, vencimento 17) gera compra com 1 parcela e a fatura correspondente.
  - Recorrente pausada não gera.
  - Origem arquivada: arquivar a conta de uma recorrente ativa e gerar → recorrente fica `paused = true` e nada é criado; criar recorrente nova numa conta arquivada → `check_violation` (hint `archived_source`).
  - Receita no cartão → `check_violation`. Categoria de tipo diferente → `check_violation`.
  - Excluir a recorrente mantém os lançamentos gerados com `recurring_id` nulo.
  - Cliente não grava `next_date`/`currency` (update → `insufficient_privilege`), nem `transactions.recurring_id` (insert com a coluna → `insufficient_privilege`).
  - `month_entries` expõe `recurring_id` dos lançamentos gerados.
  - **B**: não vê recorrentes de A (0); `generate_my_recurring()` como B não gera nada de A (contagem de lançamentos de A inalterada); criar recorrente na conta de A → `check_violation`.
  - **anon**: `select` em `recurring` → `insufficient_privilege`; `generate_my_recurring()` → `insufficient_privilege`.
  - Exclusão do usuário A em cascata (com recorrentes e lançamentos gerados) funciona (`set constraints all immediate`).
  - Existe o job `finance-recorrentes-diarias` em `cron.job`.

- [ ] **Step 3:** dry-run (`begin` + migration + corpo do teste + `select 'PASS'` + `rollback`) via `npx supabase db query --linked -f … -o json` até PASS, mais uma checagem de falha proposital; `npm test`; commit.

---

### Task 2: Regras de recorrência no cliente (TDD)

**Files:** Create `src/lib/recurrence.ts`, `src/lib/recurrence.test.ts`

**Interfaces (produz):**
- `type Frequency = 'weekly' | 'monthly' | 'yearly'`
- `nextOccurrence(dateISO: string, frequency: Frequency, anchorISO: string): string` (espelha `recurring_next`)
- `upcomingOccurrences(r: { next_date: string; frequency: Frequency; start_date: string; end_date: string | null; paused: boolean }, untilISO: string, limit?: number): string[]` — datas de `next_date` até `untilISO` (inclusive) e até `end_date`; vazia se pausada; no máximo `limit` (padrão 12).

- [ ] **Step 1: Testes** (mesmos casos de `recurring_next` do Task 1 + `upcomingOccurrences`: mensal a partir de `2026-01-31` até `2026-04-15` → `['2026-01-31','2026-02-28','2026-03-31']`; com `end_date '2026-02-28'` → 2 datas; pausada → `[]`; `limit` respeitado).
- [ ] **Step 2: Implementação** (datas locais em texto; sem `Date` UTC):

```ts
export type Frequency = 'weekly' | 'monthly' | 'yearly'

const pad = (n: number) => String(n).padStart(2, '0')
const parts = (iso: string) => iso.split('-').map(Number)
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()

export function nextOccurrence(dateISO: string, frequency: Frequency, anchorISO: string): string {
  const [y, m, d] = parts(dateISO)
  const [, am, ad] = parts(anchorISO)
  if (frequency === 'weekly') {
    const n = new Date(y, m - 1, d + 7)
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
  }
  let ty: number
  let tm: number
  if (frequency === 'monthly') {
    ty = m === 12 ? y + 1 : y
    tm = m === 12 ? 1 : m + 1
  } else {
    ty = y + 1
    tm = am
  }
  return `${ty}-${pad(tm)}-${pad(Math.min(ad, lastDayOf(ty, tm)))}`
}

export function upcomingOccurrences(
  r: { next_date: string; frequency: Frequency; start_date: string; end_date: string | null; paused: boolean },
  untilISO: string,
  limit = 12,
): string[] {
  if (r.paused) return []
  const out: string[] = []
  let d = r.next_date
  while (d <= untilISO && (!r.end_date || d <= r.end_date) && out.length < limit) {
    out.push(d)
    d = nextOccurrence(d, r.frequency, r.start_date)
  }
  return out
}
```

- [ ] **Step 3:** `npm test`, `npm run build`, commit.

---

### Task 3: Traduções da Etapa 4

**Files:** `src/i18n/locales/{pt-BR,pt-PT,en,es}.json`

pt-BR (mesclar):

```json
{
  "recurring": {
    "title": "Recorrentes", "new": "Nova recorrente", "edit": "Editar recorrente",
    "subtitle": "Receitas e despesas que se repetem são lançadas sozinhas.",
    "frequency": "Frequência", "weekly": "Semanal", "monthly": "Mensal", "yearly": "Anual",
    "everyWeek": "Toda {{weekday}}", "everyMonth": "Todo dia {{day}}", "everyYear": "Todo ano em {{date}}",
    "startDate": "Começa em", "endDate": "Termina em (opcional)", "next": "Próxima: {{date}}",
    "paused": "Pausada", "pause": "Pausar", "resume": "Retomar", "ended": "Encerrada",
    "amount": "Valor", "invalidAmount": "Informe um valor maior que zero.",
    "empty": "Nenhuma recorrente ainda",
    "emptyBody": "Cadastre salário, aluguel, assinaturas e contas fixas para lançá-los automaticamente.",
    "editHint": "As mudanças valem para os próximos lançamentos; os já lançados não mudam.",
    "deleteHint": "Os lançamentos já gerados continuam no extrato.",
    "archivedSource": "Esta conta ou cartão está arquivado. Escolha outro.",
    "badge": "Recorrente"
  },
  "home": { "upcoming": "Próximos vencimentos", "upcomingEmpty": "Nada vencendo nos próximos 30 dias.", "invoiceOf": "Fatura {{card}}" }
}
```

en: "Recurring", "New recurring", "Edit recurring", "Repeating income and expenses are recorded automatically.", "Frequency", "Weekly", "Monthly", "Yearly", "Every {{weekday}}", "Every month on the {{day}}", "Every year on {{date}}", "Starts on", "Ends on (optional)", "Next: {{date}}", "Paused", "Pause", "Resume", "Ended", "Amount", "Enter an amount greater than zero.", "No recurring items yet", "Add salary, rent, subscriptions and fixed bills to record them automatically.", "Changes apply to upcoming entries; past ones stay as they are.", "Transactions already recorded stay in your history.", "This account or card is archived. Choose another one.", "Recurring"; home: "Upcoming", "Nothing due in the next 30 days.", "{{card}} bill". pt-PT e es: traduzir seguindo o padrão dos arquivos (pt-PT "Recorrentes", "extrato" para fatura; es "Recurrentes", "resumen" para fatura; `{{…}}` idênticos).

- [ ] `npm test` (paridade) e commit.

---

### Task 4: Dados — API de recorrentes e geração ao abrir o app

**Files:** Create `src/features/recurring/{types,api}.ts`; Modify `src/features/transactions/types.ts` (+ `recurring_id: string | null` em `Transaction`; `toMonthEntry` mapeia), `src/lib/realtime.ts` (+ tabela `recurring`), `src/app/AppShell.tsx` (gera ao abrir)

**Interfaces:**
- `type Recurring = { id; user_id; kind: TransactionKind; amount: number; currency: CurrencyCode; category_id: string; description: string; account_id: string | null; card_id: string | null; frequency: Frequency; start_date: string; end_date: string | null; next_date: string; paused: boolean; created_at; updated_at }`; `RecurringInput` (colunas graváveis no insert); `RecurringPatch` (colunas graváveis no update).
- `useRecurring()` (key `['recurring', uid]`, ordenado por `next_date`), `useCreateRecurring()`, `useUpdateRecurring({id, patch})`, `useDeleteRecurring(id)`; criar/editar/retomar chamam `generate_my_recurring` em seguida e invalidam `['recurring']`, `['transactions']`, `['accounts']`, `['cards']`, `['invoices']`.
- `useGenerateRecurringOnOpen()`: uma vez por sessão de usuário, chama `supabase.rpc('generate_my_recurring')`; se criou > 0, invalida as mesmas chaves. Montado no `AppShell` (antes de qualquer retorno antecipado). Falha silenciosa (o cron cobre).
- Realtime: incluir `recurring` (INSERT/UPDATE filtrados + DELETE sem filtro, como as outras).
- [ ] Testes unitários para o mapeamento/regras novas que houver; `npm test`, `npm run build`, commit.

---

### Task 5: Tela de recorrentes

**Files:** Create `src/features/recurring/{RecurringPage,RecurringForm}.tsx`; Modify `src/app/router.tsx` (`/recurring`), `src/app/nav.ts` (item só no menu lateral do PC, depois de Categorias), `src/features/settings/SettingsPage.tsx` (link em "Seu dinheiro"), `src/features/transactions/TransactionRow.tsx` (ícone `Repeat` pequeno com `aria-label` `recurring.badge` quando `recurring_id`)

**Comportamento:**
- Lista (folha `rounded-[24px]`): cada item com `CategoryIcon`, descrição (ou categoria), linha secundária com a frequência legível (`everyWeek` com o dia da semana por extenso via `Intl`, `everyMonth` com o dia da âncora, `everyYear` com dia e mês) · origem (conta/cartão) · "Próxima: <data>" (ou "Pausada"/"Encerrada" quando `end_date < next_date`), valor com `Amount` (verde + para receita). Pausadas aparecem esmaecidas no fim (sem reduzir contraste do texto abaixo de 4.5:1 — usar pílula "Pausada" em vez de opacidade).
- Botão "Nova recorrente" abre `Sheet` com `RecurringForm`: tipo (Despesa | Receita), valor (campo de texto com `parseAmount`, erro `recurring.invalidAmount`), categoria (grade como no formulário de lançamento), "Pagar com" Conta | Cartão (só despesa; receita força conta), frequência (`SegmentedControl` Semanal | Mensal | Anual), "Começa em" (data, padrão hoje), "Termina em" opcional, descrição. Ao salvar cria e gera as ocorrências até hoje.
- Editar (clique no item): mesmo formulário com tipo e data de início bloqueados (mostrar como texto), dica `recurring.editHint`; ações Pausar/Retomar, Excluir com confirmação e dica `recurring.deleteHint` (padrão de robustez de `AccountsPage`). Erro com hint `archived_source` → `recurring.archivedSource`.
- Estado vazio com `EmptyState` e o subtítulo.

- [ ] Capturar `/recurring` (mobile+desktop) com `scripts/capture-screens.mjs` (adicionar mocks `recurring`), conferir uma vez; `npm test`, `npm run build`, commit.

---

### Task 6: Próximos vencimentos no Início

**Files:** Modify `src/features/home/HomePage.tsx`

**Comportamento:** nova folha "Próximos vencimentos" (coluna direita no PC, acima de "Últimos lançamentos"; no celular depois de "Seus cartões"): até 6 itens dos próximos 30 dias (incluindo hoje), ordenados por data, combinando (a) ocorrências de recorrentes ativas (`upcomingOccurrences(r, hoje+30)`), com ícone da categoria, descrição/categoria, data relativa ("Hoje", "Amanhã" ou dia e mês) e valor (`Amount`, + verde para receita); (b) faturas não pagas com total > 0 e vencimento até hoje+30 (ou vencidas), com a bolinha da cor do cartão, `home.invoiceOf`, data de vencimento (vermelho se vencida) e total. Clique leva à recorrente (`/recurring`) ou ao cartão (`/cards/:id`). Sem itens → `home.upcomingEmpty`. Adicionar chave `common.tomorrow` ("Amanhã"/"Amanhã"/"Tomorrow"/"Mañana") se necessário.

- [ ] Capturar Início (mobile+desktop), conferir uma vez; `npm test`, `npm run build`, `npm run e2e`; commit.

## Cobertura da especificação (Etapa 4)

| Requisito | Task |
|---|---|
| 3.8 Campos, frequências, início/fim, origem conta ou cartão | 1, 5 |
| 3.8 Geração diária sem duplicar (pg_cron + chave única) | 1 |
| 3.8 Ao criar, gera as ocorrências até hoje | 4, 5 |
| 3.8 Editar vale para as próximas; pausar/retomar | 1, 4, 5 |
| 4.1 Próximas contas a vencer no Início | 6 |
| 4.7 Recorrentes em Configurações | 5 |

Fora desta etapa: recorrente de grupo (o campo de grupo entra na Etapa 5).
