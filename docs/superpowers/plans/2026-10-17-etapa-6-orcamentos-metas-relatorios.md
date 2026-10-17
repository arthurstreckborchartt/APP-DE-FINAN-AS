# Etapa 6 — Orçamentos, Metas e Relatórios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pessoa define orçamentos mensais por categoria (pessoais e do grupo) e vê avisos a 80% e 100%; cria metas de poupança com aportes e retiradas manuais, vendo progresso e quanto guardar por mês até o prazo; e tem uma tela de Relatórios (gastos por categoria, receitas × despesas mês a mês, filtros de período, conta, cartão e grupo, comparação entre membros no grupo). O Início ganha o quadro "Orçamento do mês".

**Architecture:** Tabelas `budgets` (pessoal **ou** do grupo; categoria de despesa; moeda; valor mensal), `goals` e `goal_contributions` (o guardado é a soma dos aportes, exposto pela view `goal_progress`), com RLS e validação em gatilho. O gasto contra o orçamento é calculado no cliente a partir das entradas de competência já existentes (`month_entries` pessoal, `group_month_entries` no grupo). Relatórios agregam no cliente as entradas de um intervalo de meses (`month_entries` por intervalo; RPC nova `group_period_entries` para o grupo). Regras puras em `src/lib/budget.ts`, `src/lib/goals.ts` e `src/features/reports/aggregate.ts`, com testes. Tempo real: os gatilhos de broadcast da Etapa 5 passam a cobrir as tabelas novas.

**Tech Stack:** Supabase (Postgres, RLS, Realtime Broadcast), React 19, TanStack Query 5, i18next, Tailwind 4, SVG próprio para barras (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-10-app-financas-design.md` §3.10, §3.11, §3.9 (orçamento do grupo), §4.1 (gasto do mês × orçamento), §4.6, §4.7. Design: `DESIGN.md`.

## Global Constraints

- Tudo das etapas anteriores: 4 idiomas com paridade de chaves (teste existente; es usa "tú", pt-PT trata por "você/o seu"), dinheiro em centavos + moeda ISO, `Amount` para todo valor (respeita "ocultar valores" — inclusive eixos e balões de gráficos), RLS em todas as tabelas, funções `security definer` com `set search_path = ''`, DESIGN.md, `import type`, commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Orçamento: limite **mensal** por categoria de **despesa**. Pessoal: uma por (categoria, moeda); categoria padrão ou própria. Do grupo: uma por categoria, moeda = moeda do grupo, **só categorias padrão** (as próprias de cada membro não se somam entre pessoas); só o administrador cria/edita/exclui; todos os membros veem. Gasto do mês = soma das despesas de competência daquela categoria e moeda no mês (cartão conta parcela a parcela). Níveis: `ok` < 80% ≤ `warn` < 100% ≤ `over`.
- Meta: nome, valor-alvo, moeda, prazo opcional, ícone e cor; guardado = soma dos aportes (retirada = aporte negativo; o guardado nunca fica negativo). Aportes são manuais e **não** mexem no saldo das contas. "Por mês até o prazo" = `ceil(falta / meses restantes)`, contando o mês atual e o do prazo (mínimo 1); prazo vencido → falta inteira.
- Relatórios: valores sempre separados por moeda (sem câmbio); pagamento de fatura não é despesa; períodos: 3, 6 ou 12 meses terminando no mês atual, ou o ano atual. Intervalo máximo de 24 meses no servidor.
- Implementadores não rodam `db push`; o controlador faz dry-run em transação, aplica e roda `npm run test:db`. Ao iniciar um servidor de desenvolvimento, reutilizar o da porta 5173 se já estiver rodando; se iniciar um, parar **só esse PID** (nunca `taskkill /IM node.exe`).
- Fora desta etapa: exportar relatórios (CSV/PDF), notificações push de orçamento, metas compartilhadas no grupo.

---

### Task 1: Banco — orçamentos, metas, aportes, período do grupo + testes

**Files:** Create `supabase/migrations/20261017000001_budgets_goals.sql`, `supabase/tests/07_budgets_goals.sql`

**Interfaces (produz):**
- `budgets(id, user_id, group_id, category_id, amount, currency, created_by, created_at, updated_at)`; cliente insere `category_id, amount, currency, group_id` (o gatilho define `user_id`, `created_by` e, no grupo, a moeda); atualiza só `amount`. Hints: `budget_category` (categoria inválida ou de receita), `budget_system_category` (grupo com categoria própria). Duplicata → erro `23505`.
- `goals(id, user_id, name, target_amount, currency, deadline, icon, color, archived, created_at, updated_at)`; insere `name, target_amount, currency, deadline, icon, color`; atualiza `name, target_amount, deadline, icon, color, archived`.
- `goal_contributions(id, user_id, goal_id, amount, date, note, created_at)`; insere `goal_id, amount, date, note`; exclui. Hint `goal_negative` quando a retirada deixaria o guardado negativo.
- View `goal_progress` = colunas de `goals` + `saved bigint`, `contributions int`, `last_contribution date`.
- RPC `group_period_entries(p_group uuid, p_from date, p_to date)` → mesmas colunas de `group_month_entries` + `month date` no fim.

- [ ] **Step 1: Migration** (escrever exatamente; corrigir só bugs encontrados no dry-run, registrando no relatório):

```sql
-- Etapa 6: orçamentos (pessoais e do grupo), metas de poupança e relatórios do grupo

------------------------------------------------------------
-- Orçamentos
------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount bigint not null check (amount > 0 and amount <= 99999999999),
  currency char(3) not null
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_one_owner check ((user_id is null) <> (group_id is null))
);
create unique index budgets_personal_once on public.budgets (user_id, category_id, currency) where user_id is not null;
create unique index budgets_group_once on public.budgets (group_id, category_id) where group_id is not null;
create index budgets_group_idx on public.budgets (group_id) where group_id is not null;

-- Dono e moeda vêm do contexto: pessoal = quem lança; grupo = moeda do grupo.
-- Só categorias de despesa; no grupo, só categorias padrão.
create function public.budgets_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat_user uuid;
  cat_kind text;
  cat_archived boolean;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if new.group_id is null then
      new.user_id := auth.uid();
    else
      new.user_id := null;
      new.currency := public.group_currency(new.group_id);
    end if;
  end if;

  select c.user_id, c.kind, c.archived into cat_user, cat_kind, cat_archived
    from public.categories c where c.id = new.category_id;
  -- categoria arquivada não recebe orçamento novo (os que já existem continuam editáveis)
  if cat_kind is distinct from 'expense' or (tg_op = 'INSERT' and cat_archived) then
    raise exception 'categoria inválida' using errcode = '23514', hint = 'budget_category';
  end if;
  if new.group_id is null then
    if cat_user is not null and cat_user is distinct from new.user_id then
      raise exception 'categoria inválida' using errcode = '23514', hint = 'budget_category';
    end if;
  elsif cat_user is not null then
    raise exception 'grupo usa só categorias padrão' using errcode = '23514', hint = 'budget_system_category';
  end if;
  return new;
end;
$$;
revoke execute on function public.budgets_validate() from public, anon, authenticated;

create trigger budgets_validate before insert or update on public.budgets
  for each row execute function public.budgets_validate();
create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
create policy budgets_select on public.budgets for select to authenticated
  using (user_id = (select auth.uid()) or (group_id is not null and public.is_group_member(group_id)));
create policy budgets_insert on public.budgets for insert to authenticated
  with check ((group_id is null and user_id = (select auth.uid()))
              or (group_id is not null and public.is_group_admin(group_id)));
create policy budgets_update on public.budgets for update to authenticated
  using (user_id = (select auth.uid()) or (group_id is not null and public.is_group_admin(group_id)))
  with check (user_id = (select auth.uid()) or (group_id is not null and public.is_group_admin(group_id)));
create policy budgets_delete on public.budgets for delete to authenticated
  using (user_id = (select auth.uid()) or (group_id is not null and public.is_group_admin(group_id)));

revoke all on public.budgets from anon, authenticated;
grant select, delete on public.budgets to authenticated;
grant insert (category_id, amount, currency, group_id) on public.budgets to authenticated;
grant update (amount) on public.budgets to authenticated;

------------------------------------------------------------
-- Metas e aportes
------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  target_amount bigint not null check (target_amount > 0 and target_amount <= 99999999999),
  currency char(3) not null
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  deadline date check (deadline is null or deadline between '2000-01-01' and '2100-12-31'),
  icon text not null default 'piggy-bank' check (icon ~ '^[a-z0-9-]{1,40}$'),
  color text not null default '#5b3df5' check (color ~ '^#[0-9a-f]{6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

alter table public.goals enable row level security;
create policy goals_select_own on public.goals for select to authenticated using (user_id = (select auth.uid()));
create policy goals_insert_own on public.goals for insert to authenticated with check (user_id = (select auth.uid()));
create policy goals_update_own on public.goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goals_delete_own on public.goals for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.goals from anon, authenticated;
grant select, delete on public.goals to authenticated;
grant insert (name, target_amount, currency, deadline, icon, color) on public.goals to authenticated;
grant update (name, target_amount, deadline, icon, color, archived) on public.goals to authenticated;

create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  amount bigint not null check (amount <> 0 and amount between -99999999999 and 99999999999),
  date date not null default current_date check (date between '2000-01-01' and '2100-12-31'),
  note text not null default '' check (char_length(note) <= 80),
  created_at timestamptz not null default now()
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id, date desc);

alter table public.goal_contributions enable row level security;
create policy goal_contributions_select_own on public.goal_contributions for select to authenticated
  using (user_id = (select auth.uid()));
create policy goal_contributions_insert_own on public.goal_contributions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy goal_contributions_delete_own on public.goal_contributions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.goal_contributions from anon, authenticated;
grant select, delete on public.goal_contributions to authenticated;
grant insert (goal_id, amount, date, note) on public.goal_contributions to authenticated;

-- A meta tem de ser da pessoa; o guardado nunca fica negativo (trava a meta para somar com segurança).
create function public.goal_contributions_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_saved bigint;
begin
  perform 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id for update;
  if not found then
    raise exception 'meta inválida' using errcode = '23514';
  end if;
  select coalesce(sum(c.amount), 0) into v_saved from public.goal_contributions c where c.goal_id = new.goal_id;
  if v_saved + new.amount < 0 then
    raise exception 'retirada maior que o guardado' using errcode = '23514', hint = 'goal_negative';
  end if;
  return new;
end;
$$;
revoke execute on function public.goal_contributions_validate() from public, anon, authenticated;
create trigger goal_contributions_validate before insert on public.goal_contributions
  for each row execute function public.goal_contributions_validate();

-- Excluir um aporte também não pode deixar o guardado negativo.
create function public.goal_contributions_guard_delete() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_saved bigint;
begin
  -- Cascatas (excluir a pessoa ou a meta) rodam dentro dos gatilhos de FK: não há o que proteger.
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if not exists (select 1 from public.goals g where g.id = old.goal_id) then
    return old; -- meta sendo excluída (cascata)
  end if;
  perform 1 from public.goals g where g.id = old.goal_id for update;
  select coalesce(sum(c.amount), 0) into v_saved from public.goal_contributions c where c.goal_id = old.goal_id;
  if v_saved - old.amount < 0 then
    raise exception 'guardado ficaria negativo' using errcode = '23514', hint = 'goal_negative';
  end if;
  return old;
end;
$$;
revoke execute on function public.goal_contributions_guard_delete() from public, anon, authenticated;
create trigger goal_contributions_guard_delete before delete on public.goal_contributions
  for each row execute function public.goal_contributions_guard_delete();

create view public.goal_progress with (security_invoker = true) as
select
  g.id, g.user_id, g.name, g.target_amount, g.currency, g.deadline, g.icon, g.color, g.archived,
  g.created_at, g.updated_at,
  coalesce(sum(c.amount), 0)::bigint as saved,
  count(c.id)::int as contributions,
  max(c.date) as last_contribution
from public.goals g
left join public.goal_contributions c on c.goal_id = g.id
group by g.id;

revoke all on public.goal_progress from anon, authenticated;
grant select on public.goal_progress to authenticated;

------------------------------------------------------------
-- Relatórios do grupo: entradas de um intervalo de meses (máx. 24)
------------------------------------------------------------
create function public.group_period_entries(p_group uuid, p_from date, p_to date)
returns table (
  entry_id uuid, transaction_id uuid, user_id uuid, kind text, amount bigint, currency char(3), date date,
  category_id uuid, category_name text, category_key text, category_icon text, category_color text,
  description text, is_card boolean, installment_number smallint, installments_count smallint,
  created_at timestamptz, month date
)
language sql stable security definer set search_path = ''
as $$
  select e.entry_id, e.transaction_id, e.user_id, e.kind, e.amount, e.currency, e.date,
    c.id, c.name, c.i18n_key, c.icon, c.color,
    e.description, e.card_id is not null, e.installment_number, e.installments_count, e.created_at,
    e.month
  from public.month_entries e
  join public.categories c on c.id = e.category_id
  where e.group_id = p_group
    and e.month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
    and date_trunc('month', p_from) >= date_trunc('month', p_to) - interval '23 months'
    and public.is_group_member(p_group)
  order by e.date desc, e.created_at desc, e.entry_id
$$;
revoke execute on function public.group_period_entries(uuid, date, date) from public, anon;
grant execute on function public.group_period_entries(uuid, date, date) to authenticated;

------------------------------------------------------------
-- Tempo real: avisos das tabelas novas
------------------------------------------------------------
create function public.broadcast_budget_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_group uuid := coalesce(new.group_id, old.group_id);
begin
  if v_user is not null then
    perform public.notify_topic('user:' || v_user::text, tg_table_name, tg_op);
  end if;
  if v_group is not null then
    perform public.notify_topic('group:' || v_group::text, tg_table_name, tg_op);
  end if;
  return null;
end;
$$;
revoke execute on function public.broadcast_budget_change() from public, anon, authenticated;

create trigger budgets_broadcast after insert or update or delete on public.budgets
  for each row execute function public.broadcast_budget_change();
create trigger goals_broadcast after insert or update or delete on public.goals
  for each row execute function public.broadcast_owner_change();
create trigger goal_contributions_broadcast after insert or update or delete on public.goal_contributions
  for each row execute function public.broadcast_owner_change();
```

- [ ] **Step 2: Testes** `supabase/tests/07_budgets_goals.sql` no estilo de `supabase/tests/05_groups.sql` (transação com `rollback`, usuários fictícios `...a7`, `...b7`, `...c7`, troca com `set local request.jwt.claims`, `raise exception 'FAIL: …'`, última linha `select 'PASS' as result;`). Casos obrigatórios:
  1. A cria orçamento pessoal (Moradia, BRL, 100000) → `user_id = A`, `group_id` nulo, `created_by = A`; outro igual (mesma categoria e moeda) → `23505`; mesma categoria em EUR → ok; categoria de receita → hint `budget_category`; categoria própria de B → `budget_category`; categoria própria de A → ok.
  2. B não vê nem altera/exclui o orçamento pessoal de A (`select` 0; `update`/`delete` 0 linhas).
  3. A cria grupo G (BRL) e B entra (via `create_group_invite`/`join_group`). A (admin) cria orçamento do grupo para Mercado passando `currency = 'EUR'` → gravado com `currency = 'BRL'` e `user_id` nulo; com categoria própria → `budget_system_category`; B (membro) vê o orçamento do grupo, mas inserir/alterar/excluir orçamento do grupo falha (RLS: `42501` no insert, 0 linhas no update/delete); C (não membro) não vê.
  4. A altera só `amount` → ok; tentar alterar `category_id`/`currency`/`group_id` → `42501` (permissão de coluna).
  5. Metas: A cria meta (BRL, alvo 500000, prazo); aporte 100000 → `goal_progress.saved = 100000`, `contributions = 1`; retirada −50000 → `saved = 50000`; retirada −60000 → hint `goal_negative`; excluir o aporte de +100000 (deixaria −50000) → `goal_negative`; excluir a retirada → ok; aporte em meta de B (como A) → erro; B não vê metas/aportes de A; excluir a meta remove os aportes (cascata) sem erro.
  6. `group_period_entries`: lançamentos do grupo de A e B em 3 meses diferentes (um parcelado no cartão) → intervalo de 3 meses traz todas as entradas com `month` correto; intervalo de 25 meses → 0 linhas; C (não membro) → 0 linhas.
  7. Tempo real: inserir orçamento pessoal gera mensagem em `user:A`; orçamento do grupo gera em `group:G` (e nenhuma em `user:`); aporte gera em `user:A` (mesma técnica de contagem em `realtime.messages` do `06_realtime.sql`, incluindo a proteção de partição ausente).
- [ ] **Step 3:** Não rodar `db push`. Validar por dry-run em transação desfeita (migration + 07; e migration + cada um de 02–06). Commit (`feat: banco de orçamentos, metas e período do grupo`).

---

### Task 2: Traduções da Etapa 6

**Files:** `src/i18n/locales/{pt-BR,pt-PT,en,es}.json`

pt-BR (mesclar):

```json
{
  "budgets": {
    "title": "Orçamentos",
    "subtitle": "Defina quanto quer gastar por categoria em cada mês. Avisamos ao chegar em 80% e 100%.",
    "new": "Novo orçamento", "edit": "Editar orçamento", "save": "Salvar", "delete": "Excluir orçamento",
    "deleteConfirm": "Excluir este orçamento? Seus lançamentos não mudam.",
    "category": "Categoria", "amount": "Limite por mês", "currency": "Moeda",
    "invalidAmount": "Informe um valor maior que zero.",
    "empty": "Nenhum orçamento ainda",
    "emptyBody": "Escolha as categorias em que você quer ficar de olho e defina um limite para o mês.",
    "spentOf": "{{spent}} de {{limit}}",
    "left": "Faltam {{amount}}", "over": "Passou {{amount}}",
    "warn": "Perto do limite", "overLabel": "Acima do limite",
    "total": "Total do mês", "pct": "{{pct}}%",
    "allBudgeted": "Todas as categorias desta moeda já têm orçamento.",
    "duplicate": "Esta categoria já tem orçamento nesta moeda.",
    "categoryInvalid": "Escolha uma categoria de despesa.",
    "systemOnly": "No grupo, só categorias padrão podem ter orçamento.",
    "group": "Orçamento do grupo",
    "groupEmpty": "Sem orçamento no grupo.",
    "groupEmptyAdmin": "Defina limites mensais por categoria para o grupo todo.",
    "groupHint": "Soma os lançamentos do grupo de todos os membros."
  },
  "goals": {
    "title": "Metas",
    "subtitle": "Guarde dinheiro para o que importa e acompanhe quanto falta.",
    "new": "Nova meta", "edit": "Editar meta", "save": "Salvar",
    "name": "Nome da meta", "target": "Valor da meta", "currency": "Moeda",
    "deadline": "Prazo (opcional)", "icon": "Ícone", "color": "Cor",
    "invalidAmount": "Informe um valor maior que zero.", "nameRequired": "Dê um nome à meta.",
    "empty": "Nenhuma meta ainda",
    "emptyBody": "Crie uma meta — viagem, reserva de emergência, um sonho — e registre o que for guardando.",
    "savedOf": "{{saved}} de {{target}}", "pct": "{{pct}}%",
    "remaining": "Faltam {{amount}}",
    "perMonth": "Guarde {{amount}} por mês até {{date}}",
    "overdue": "O prazo passou — faltam {{amount}}",
    "reached": "Meta atingida",
    "noDeadline": "Sem prazo",
    "deposit": "Guardar", "withdraw": "Retirar",
    "contributionAmount": "Valor", "contributionDate": "Data", "note": "Observação (opcional)",
    "history": "Histórico",
    "historyEmpty": "Nenhum aporte ainda.",
    "deleteContribution": "Excluir aporte",
    "negative": "Não dá para retirar mais do que está guardado.",
    "archive": "Arquivar meta", "unarchive": "Reativar meta", "archived": "Arquivadas",
    "delete": "Excluir meta", "deleteConfirm": "Excluir esta meta e todo o histórico de aportes?",
    "manualHint": "Os valores guardados aqui não mexem no saldo das suas contas."
  },
  "reports": {
    "title": "Relatórios",
    "subtitle": "Para onde vai o seu dinheiro, mês a mês.",
    "scope": "Ver", "personal": "Pessoal",
    "period": "Período", "last3": "3 meses", "last6": "6 meses", "last12": "12 meses", "thisYear": "Este ano",
    "source": "Conta ou cartão", "allSources": "Todas as contas e cartões",
    "income": "Receitas", "expense": "Despesas", "balance": "Saldo do período", "avgExpense": "Média de gastos por mês",
    "incomeVsExpense": "Receitas × despesas", "byCategory": "Gastos por categoria",
    "byMember": "Gastos por membro", "memberComparison": "Comparação entre membros",
    "empty": "Nada lançado neste período.",
    "share": "{{pct}}% das despesas",
    "chartHidden": "Valores ocultos"
  },
  "home": {
    "budget": "Orçamento do mês",
    "budgetEmpty": "Defina limites por categoria para acompanhar seus gastos.",
    "budgetCta": "Criar orçamento",
    "seeAll": "Ver tudo"
  }
}
```

en: budgets — "Budgets", "Set how much you want to spend per category each month. We'll warn you at 80% and 100%.", "New budget", "Edit budget", "Save", "Delete budget", "Delete this budget? Your entries don't change.", "Category", "Monthly limit", "Currency", "Enter an amount greater than zero.", "No budgets yet", "Pick the categories you want to keep an eye on and set a limit for the month.", "{{spent}} of {{limit}}", "{{amount}} left", "{{amount}} over", "Close to the limit", "Over the limit", "Month total", "{{pct}}%", "Every category in this currency already has a budget.", "This category already has a budget in this currency.", "Choose an expense category.", "In a group, only default categories can have a budget.", "Group budget", "No group budget.", "Set monthly limits per category for the whole group.", "Adds up group entries from every member."; goals — "Goals", "Save money for what matters and track how much is left.", "New goal", "Edit goal", "Save", "Goal name", "Goal amount", "Currency", "Deadline (optional)", "Icon", "Color", "Enter an amount greater than zero.", "Give the goal a name.", "No goals yet", "Create a goal — a trip, an emergency fund, a dream — and record what you put aside.", "{{saved}} of {{target}}", "{{pct}}%", "{{amount}} to go", "Save {{amount}} a month until {{date}}", "The deadline has passed — {{amount}} to go", "Goal reached", "No deadline", "Add", "Withdraw", "Amount", "Date", "Note (optional)", "History", "No contributions yet.", "Delete contribution", "You can't withdraw more than you've saved.", "Archive goal", "Reactivate goal", "Archived", "Delete goal", "Delete this goal and all its contributions?", "Amounts saved here don't change your account balances."; reports — "Reports", "Where your money goes, month by month.", "View", "Personal", "Period", "3 months", "6 months", "12 months", "This year", "Account or card", "All accounts and cards", "Income", "Expenses", "Period balance", "Average spending per month", "Income vs. expenses", "Spending by category", "Spending by member", "Member comparison", "Nothing recorded in this period.", "{{pct}}% of expenses", "Values hidden"; home — "This month's budget", "Set limits per category to keep track of your spending.", "Create budget", "See all". pt-PT e es: traduzir seguindo o padrão dos arquivos (es com "tú"; pt-PT com "o seu", "registar", "poupar"; `{{…}}` idênticos).

- [ ] `npm test` (paridade) e commit (`feat: traduções da etapa 6 (orçamentos, metas e relatórios)`).

---

### Task 3: Regras e dados — orçamento, metas, agregações de relatório

**Files:** Create `src/lib/budget.ts`, `src/lib/budget.test.ts`, `src/lib/goals.ts`, `src/lib/goals.test.ts`, `src/features/reports/aggregate.ts`, `src/features/reports/aggregate.test.ts`, `src/features/budgets/{types,api}.ts`, `src/features/goals/{types,api}.ts`, `src/features/reports/api.ts`; Modify `src/lib/realtime.ts` (chaves `['budgets']`, `['goals']` em `AFFECTED_KEYS`), `src/features/groups/types.ts` (+ `GroupPeriodEntry = GroupEntry & { month: string }`)

**Interfaces (produz):**

```ts
// src/lib/budget.ts
export type BudgetLevel = 'ok' | 'warn' | 'over'
/** Percentual inteiro (arredondado para baixo), sem teto: 150 quando passou metade. */
export function budgetPct(spent: number, limit: number): number
/** ok < 80% ≤ warn < 100% ≤ over. */
export function budgetLevel(spent: number, limit: number): BudgetLevel
/** Soma das despesas por categoria em uma moeda (entradas de competência). */
export function spentByCategory(
  entries: { kind: 'income' | 'expense'; category_id: string; currency: string; amount: number }[],
  currency: string,
): Map<string, number>

// src/lib/goals.ts
export type GoalPlan = {
  remaining: number        // max(target - saved, 0)
  pct: number              // inteiro 0..100 (arredondado para baixo; 100 se atingiu)
  reached: boolean
  monthsLeft: number | null // null sem prazo; ≥ 1 com prazo futuro ou no mês atual; 0 se o prazo passou
  perMonth: number | null  // ceil(remaining / monthsLeft); null sem prazo, se atingiu ou se o prazo passou
  overdue: boolean         // prazo < hoje e não atingiu
}
export function goalPlan(target: number, saved: number, todayISO: string, deadline: string | null): GoalPlan

// src/features/reports/aggregate.ts
export type ReportEntry = {
  kind: 'income' | 'expense'; amount: number; currency: string; month: string /* 'YYYY-MM' */
  category_id: string; account_id?: string | null; card_id?: string | null; user_id?: string
}
export function monthsBetween(fromMonth: string, toMonth: string): string[] // inclusivo, 'YYYY-MM'
export function periodMonths(preset: 'last3' | 'last6' | 'last12' | 'thisYear', currentMonth: string): { from: string; to: string }
export function monthlyTotals(entries: ReportEntry[], months: string[], currency: string): { month: string; income: number; expense: number }[]
export function categoryTotals(entries: ReportEntry[], currency: string): { category_id: string; amount: number; share: number }[] // só despesas; share inteiro; ordenado desc
export function memberMonthly(entries: ReportEntry[], months: string[], currency: string): { user_id: string; values: number[]; total: number }[] // só despesas; ordenado por total desc
export function currenciesOf(entries: ReportEntry[]): string[] // ordenadas por volume de despesas desc
```

- Testes (escrever antes): `budgetPct(0, 100) = 0`, `(79, 100) = 79`, `(150, 100) = 150`; `budgetLevel` nos limites 79/80/99/100; `spentByCategory` ignora receitas e outras moedas e soma parcelas. `goalPlan`: sem prazo (`perMonth` nulo); prazo no mês atual (`monthsLeft = 1`); prazo em 3 meses (inclui atual: `2026-10-17` → `2026-12-05` ⇒ 3) com `ceil`; prazo passado (`overdue`, `monthsLeft = 0`, `perMonth` nulo); atingida (saved ≥ target ⇒ `reached`, `remaining 0`, `pct 100`). `monthsBetween('2025-11','2026-02')` = 4 meses; `periodMonths('last6','2026-10')` = `2026-05..2026-10`; `periodMonths('thisYear','2026-10')` = `2026-01..2026-10`; `monthlyTotals` com meses sem lançamentos = 0; `categoryTotals` shares; `memberMonthly`.
- `src/features/budgets/types.ts`: `Budget = { id; user_id: string | null; group_id: string | null; category_id: string; amount: number; currency: CurrencyCode; created_at; updated_at }`; `BudgetInput = { category_id: string; amount: number; currency: CurrencyCode; group_id: string | null }`.
- `src/features/budgets/api.ts`: `useBudgets()` → `['budgets', uid, 'mine']`, `.eq('user_id', uid)` (obrigatório: o RLS também devolve orçamentos dos grupos); `useGroupBudgets(groupId)` → `['budgets', uid, 'group', groupId]`, `.eq('group_id', groupId)`; `useCreateBudget()`, `useUpdateBudget()` (`{ id, amount }`), `useDeleteBudget()` (`mutate(id)`) — invalidam `['budgets']`; update/delete com `.select('id')` e erro se 0 linhas.
- `src/features/goals/types.ts`: `Goal` (linha de `goal_progress`, `saved`/`target_amount` com `Number()`), `GoalInput`, `GoalPatch`, `GoalContribution`. `src/features/goals/api.ts`: `useGoals()` → `['goals', uid, 'list']` de `goal_progress` (`order('archived').order('created_at')`); `useGoalContributions(goalId)` → `['goals', uid, goalId, 'contributions']` (ordem data desc, created_at desc); `useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`, `useAddContribution` (`{ goal_id, amount, date, note }`, amount negativo para retirada), `useDeleteContribution` — invalidam `['goals']`.
- `src/features/reports/api.ts`: `useEntriesRange(from, to)` → `['transactions', uid, 'range', from, to]` lendo `month_entries` com `.gte('month', \`${from}-01\`).lte('month', \`${to}-01\`)` e mapeando com `toMonthEntry` + `month` ('YYYY-MM'); `useGroupPeriodEntries(groupId, from, to)` → `['groups', uid, groupId, 'period', from, to]` via `rpc('group_period_entries', { p_group, p_from: \`${from}-01\`, p_to: \`${to}-01\` })`.
- [ ] `npm test`, `npm run build`, commit (`feat: regras de orçamento, metas e relatórios`).

---

### Task 4: Orçamentos pessoais + quadro no Início

**Files:** Create `src/features/budgets/{BudgetsPage,BudgetForm,BudgetRow}.tsx`; Modify `src/app/router.tsx` (`/budgets`), `src/app/nav.ts`, `src/features/settings/SettingsPage.tsx`, `src/features/home/HomePage.tsx`, `scripts/capture-screens.mjs`

**Comportamento:**
- Navegação: itens `sidebarOnly` novos, nesta ordem depois de Grupos: Relatórios (`/reports`, `ChartColumn`/`BarChart3`), Orçamentos (`/budgets`, `Target`), Metas (`/goals`, `PiggyBank`); depois Contas, Categorias, Recorrentes. Em Ajustes ("Seu dinheiro"), links para Orçamentos, Metas e Relatórios, além dos existentes. As rotas `/reports` e `/goals` só entram nos Tasks 6 e 7 — neste task adicionar só `/budgets` e os itens de navegação dos três (os ainda sem rota caem no `*` → `/`; os Tasks 6/7 registram as rotas).
- `BudgetsPage`: cabeçalho (título, subtítulo, botão "Novo orçamento"); `MonthSwitcher` (mesmo estado de mês do extrato, `?month=`); se a pessoa tem orçamentos em mais de uma moeda, `SegmentedControl` de moeda (padrão: moeda do perfil se houver orçamento nela). Folha de resumo: `budgets.total` com `Amount` gasto / `Amount` limite, barra única e percentual. Lista (`BudgetRow`): `CategoryIcon`, nome (`categoryLabel`), linha "`budgets.spentOf`" com dois `Amount`, barra (cor `primary` em `ok`, `warning` em `warn`, `danger` em `over`; largura limitada a 100% e, se passou, a barra cheia em `danger`), à direita o percentual e, abaixo, `budgets.left` ou `budgets.over` (valor via `Amount`). Ordenação: maior percentual primeiro. Itens em `warn`/`over` têm pílula `budgets.warn`/`budgets.overLabel` (texto + cor — nunca só cor). Clique abre edição.
- `BudgetForm` (em `Sheet`, reutilizado no Task 5 com `mode: 'personal' | 'group'`): grade de categorias de **despesa** (no modo grupo, só as padrão — `user_id === null`), escondendo as que já têm orçamento na moeda escolhida (na edição, a categoria aparece fixa como texto); moeda (`SelectField`, padrão a do perfil; no modo grupo, fixa e mostrada como pílula); limite (campo de texto com `parseAmount`, erro `budgets.invalidAmount`). Edição: só o limite + "Excluir orçamento" com confirmação. Erros: `23505` → `budgets.duplicate`; hint `budget_category` → `budgets.categoryInvalid`; `budget_system_category` → `budgets.systemOnly`; genéricos via `common.errorGeneric`. Robustez como em `AccountsPage` (ocupado, sem envio duplo).
- Gasto do mês: `useTransactions(month)` (entradas de competência) + `spentByCategory`.
- Estado vazio: `EmptyState` (`budgets.empty`/`budgets.emptyBody`) com botão.
- Início: nova folha "Orçamento do mês" (`home.budget`) na coluna esquerda do PC logo depois de "Este mês" e no celular depois de "Este mês": se há orçamentos na moeda principal do perfil, mostra o total (gasto/limite com barra) e até 3 categorias com maior percentual (mesmo `BudgetRow` compacto), ação `home.seeAll` → `/budgets`; sem orçamentos, texto `home.budgetEmpty` + botão `home.budgetCta` → `/budgets`.
- Mocks em `capture-screens.mjs` (`budgets` com 5 orçamentos em BRL: um em `warn`, um em `over`) e shot `['budgets', '/budgets']`; conferir também o Início. Conferir uma vez cada.
- [ ] Testes de componente para `BudgetRow` (níveis, texto "Passou", `Amount` mascarado quando valores ocultos); `npm test`, `npm run build`, `npm run e2e`, commit (`feat: orçamentos pessoais e quadro no Início`).

---

### Task 5: Orçamento do grupo

**Files:** Modify `src/features/groups/GroupDetailPage.tsx` (+ seção), Create `src/features/groups/GroupBudgetSection.tsx`; Modify `scripts/capture-screens.mjs`

**Comportamento:**
- Na tela do grupo, nova folha "Orçamento do grupo" (`budgets.group`) na coluna esquerda depois de "Por categoria" (celular: mesma ordem), com `budgets.groupHint` em texto pequeno. Dados: `useGroupBudgets(groupId)` + gasto de `useGroupEntries(groupId, month)` (mesmo mês do `MonthSwitcher` da página) com `spentByCategory` na moeda do grupo. Cada item usa o `BudgetRow` do Task 4 (categoria vinda de `useCategories()` — categorias padrão estão sempre disponíveis).
- Admin: botão "Novo orçamento" na folha e clique no item abre o `BudgetForm` em modo grupo (`group_id`, moeda fixa do grupo, só categorias padrão). Membro: só leitura (itens não clicáveis).
- Vazio: membro vê `budgets.groupEmpty`; admin vê `budgets.groupEmptyAdmin` + botão.
- Mocks `budgets?group_id=eq.<Casa>` (3 orçamentos) e re-captura do shot `group`; conferir uma vez.
- [ ] `npm test`, `npm run build`, `npm run e2e`, commit (`feat: orçamento do grupo`).

---

### Task 6: Metas de poupança

**Files:** Create `src/features/goals/{GoalsPage,GoalForm,GoalSheet,GoalCard}.tsx`; Modify `src/app/router.tsx` (`/goals`), `scripts/capture-screens.mjs`

**Comportamento:**
- `GoalsPage`: cabeçalho (título, subtítulo, "Nova meta"); grade de `GoalCard` (1 coluna no celular, 2 no PC): ladrilho com ícone na cor da meta, nome, `goals.savedOf` (dois `Amount`), barra de progresso na cor da meta (contraste mínimo do texto garantido — texto nunca sobre a cor), percentual, e linha de plano: `goals.reached` (com ícone `CircleCheck`), `goals.overdue`, `goals.perMonth` (data do prazo em mês/ano curto via `Intl`) ou `goals.noDeadline` + `goals.remaining`. Valores via `Amount` (ocultáveis; quando ocultos, o percentual continua visível). Seção recolhível "Arquivadas" no fim. Vazio: `EmptyState`.
- `GoalForm` (em `Sheet`): nome (1–40, `goals.nameRequired`), valor da meta (`parseAmount`), moeda (padrão do perfil; fixa na edição), prazo opcional (date), ícone (grade de ~10: `piggy-bank`, `plane`, `home`, `car`, `graduation-cap`, `heart`, `gift`, `umbrella`, `laptop`, `baby`) com rótulos traduzidos via `categories.iconOption`, cor (8 cores da paleta das categorias). Erros genéricos via `common.errorGeneric`.
- `GoalSheet` (clique no card): resumo da meta + dois botões "Guardar" e "Retirar" que abrem um formulário curto (valor, data padrão hoje, observação) — retirada envia valor negativo; erro com hint `goal_negative` → `goals.negative`. "Histórico": lista de aportes (data, observação, `Amount` com + verde ou − ), cada um com excluir (confirmação; mesmo hint). Ações: editar, arquivar/reativar, excluir (confirmação `goals.deleteConfirm`). Nota `goals.manualHint`.
- Mocks `goal_progress` (4 metas: uma atingida, uma com prazo vencido, uma sem prazo, uma arquivada) e `goal_contributions`; shot `['goals', '/goals']`; conferir uma vez.
- [ ] Testes de componente para `GoalCard` (atingida / vencida / por mês / valores ocultos); `npm test`, `npm run build`, `npm run e2e`, commit (`feat: metas de poupança com aportes`).

---

### Task 7: Gráfico de barras e tela de Relatórios

**Files:** Create `src/components/ui/BarChart.tsx`, `src/components/ui/BarChart.test.tsx`, `src/features/reports/ReportsPage.tsx`; Modify `src/app/router.tsx` (`/reports`), `scripts/capture-screens.mjs`

**Comportamento:**
- Antes de escrever código de gráfico, carregar a skill `dataviz` e seguir suas regras de forma, cor e interação (dentro dos tokens do `DESIGN.md`).
- `BarChart` (SVG próprio, responsivo por `viewBox`/`ResizeObserver`): props `{ labels: string[]; series: { name: string; color: string; values: number[] }[]; format: (v: number) => string; hidden?: boolean; height?: number; ariaLabel: string }`. Barras agrupadas por rótulo (1–6 séries), cantos superiores arredondados, linha de base, 3–4 linhas de grade discretas com rótulos do eixo Y via `format` (ocultos quando `hidden`), rótulos do eixo X (meses curtos via `Intl`, alinhados como no `LineChart`), balão ao passar o mouse/dedo ou focar (teclado: setas entre grupos) com o nome do mês e o valor de cada série (`••••` quando `hidden`), legenda quando há mais de uma série. Acessível: `role="img"` + `aria-label` e uma tabela visualmente oculta com os dados (valores mascarados quando ocultos). Teste: renderiza N grupos × M barras, balão aparece no foco, valores mascarados com `hidden`.
- `ReportsPage` (`/reports`):
  - Controles: "Ver" — chips `reports.personal` + um por grupo (`useMyGroups`); "Período" — `SegmentedControl` 3/6/12 meses/Este ano (padrão 6 meses, guardado na URL `?period=`); no modo pessoal, `SelectField` "Conta ou cartão" (todas as contas e cartões na moeda escolhida, incluindo arquivados que tenham lançamentos no período) e, se houver mais de uma moeda no período, `SegmentedControl` de moeda (padrão: maior volume de despesas).
  - Resumo (pessoal): `reports.income`, `reports.expense`, `reports.balance` (receitas − despesas, cor por sinal) e `reports.avgExpense` (despesas ÷ meses do período), todos com `Amount`. No grupo: total de despesas do grupo e média por mês.
  - "Receitas × despesas" (pessoal): `BarChart` com 2 séries (receitas `success`, despesas `primary`) por mês.
  - "Gastos por categoria": barra empilhada fina (como no Início) + lista com ícone, nome, `Amount` e `reports.share`.
  - Grupo: "Gastos por membro" — lista de totais com barras (reutilizar visual do "Quem gastou quanto") e "Comparação entre membros" — `BarChart` com uma série por membro (até 6; demais somados em "Outros"), nomes via `memberDisplayName` (`src/features/groups/display.ts`).
  - Dados: pessoal `useEntriesRange(from, to)` filtrado no cliente por conta/cartão; grupo `useGroupPeriodEntries` + `useGroupMembers`. Vazio: `reports.empty`. Carregando: spinner; erro: `QueryError`.
  - Layout: PC em duas colunas (esquerda resumo + receitas×despesas/comparação; direita categorias/membros); celular empilhado.
- Mocks para `month_entries` em intervalo (6 meses, 2 moedas) e `rpc/group_period_entries`; shots `['reports', '/reports']` e `['reports-group', '/reports?scope=<Casa id>']` (se o escopo ficar na URL; senão só o primeiro); conferir uma vez.
- [ ] `npm test`, `npm run build`, `npm run e2e`, commit (`feat: relatórios com gráficos de barras`).

## Cobertura da especificação (Etapa 6)

| Requisito | Task |
|---|---|
| 3.10 Orçamento mensal por categoria, pessoal | 1, 3, 4 |
| 3.10 Orçamento do grupo (soma de todos os membros) | 1, 3, 5 |
| 3.10 Avisos visuais a 80% e 100% | 3, 4, 5 |
| 3.10 Meta: nome, alvo, prazo, guardado (aportes manuais), progresso, quanto por mês | 1, 3, 6 |
| 3.11 Gastos por categoria, evolução mensal, filtros período/conta/cartão/grupo | 1, 3, 7 |
| 3.11 No grupo: comparação entre membros | 1, 3, 7 |
| 4.1 Início: gasto do mês × orçamento | 4 |
| 4.6 Tela de Relatórios; 4.7 Orçamentos e Metas em Mais/Configurações | 4, 6, 7 |
| 7 Tempo real cobre orçamentos e metas | 1, 3 |
