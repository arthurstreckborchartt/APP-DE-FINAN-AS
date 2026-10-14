# Etapa 5 — Grupos e Convites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pessoa cria grupos (nome, moeda, ícone), convida outras por link válido por 7 dias e marca lançamentos (e recorrentes) para o grupo; a tela do grupo mostra o total do mês, quanto cada membro gastou, gastos por categoria e a lista de lançamentos do grupo — sem nunca expor contas, cartões ou lançamentos pessoais de ninguém. Antes, o tempo real deixa de receber exclusões de outros usuários (canais privados por usuário e por grupo).

**Architecture:** Tabelas `groups`, `group_members` (papel admin|member, `left_at` para quem saiu) e `group_invites` (token longo, `expires_at`, `revoked_at`), com RLS. Toda escrita de membros/convites passa por funções `security definer` (`create_group`, `create_group_invite`, `revoke_group_invite`, `join_group`, `leave_group`, `remove_member`, `transfer_admin`). `transactions.group_id` e `recurring.group_id` (opcionais) são validados no gatilho (membro ativo + mesma moeda). **As leituras do grupo usam RPCs `security definer` (`my_groups`, `group_member_list`, `group_month_entries`, `group_invite_preview`) em vez de abrir o RLS das tabelas base**: as consultas pessoais do app não filtram por `user_id` (confiam no RLS "só o dono"), então abrir o RLS misturaria lançamentos alheios no extrato pessoal. Tempo real: gatilhos chamam `realtime.send` para os tópicos privados `user:<id>` e `group:<id>`; uma policy em `realtime.messages` autoriza só o próprio usuário e membros ativos; o app troca `postgres_changes` por `broadcast` em canais privados.

**Tech Stack:** Supabase (Postgres, RLS, Realtime Broadcast com canais privados), React 19, TanStack Query 5, i18next, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-10-app-financas-design.md` §3.4 (categorias visíveis ao grupo), §3.5 (grupo no lançamento), §3.8 (grupo na recorrente), §3.9, §4.5, §4.9, §6, §7. Design: `DESIGN.md`.

## Global Constraints

- Tudo das etapas anteriores: 4 idiomas com paridade de chaves (teste existente), dinheiro em centavos + moeda ISO, `Amount` para todo valor (respeita "ocultar valores"), RLS em todas as tabelas, funções `security definer` com `set search_path = ''`, DESIGN.md, `import type`, commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Membros veem **apenas** lançamentos marcados para o grupo; nunca contas, cartões, faturas ou lançamentos pessoais dos outros. RPCs de grupo nunca devolvem `account_id`/`card_id` (só `is_card`).
- Marcar lançamento/recorrente para um grupo exige ser membro ativo (checado ao inserir ou trocar de grupo) e moeda igual à do grupo (checada ao inserir, trocar de grupo ou trocar de origem). Hints: `not_group_member`, `group_currency`.
- Um único administrador por grupo. Admin não sai (hint `admin_must_transfer`): exclui o grupo ou passa a administração. Admin remove membros (não a si mesmo: `cannot_remove_self`) e gerencia convites (`not_admin` para os demais). Máximo de 50 membros ativos (`group_full`).
- Convite: link `<origem>/join/<token>`, vale 7 dias, reutilizável até expirar ou ser revogado. Hints: `invite_invalid`, `invite_expired`.
- Membro removido pelo admin só volta com um link criado depois da remoção (hint `removed_from_group`; preview com status `removed`). Quem saiu por conta própria volta com qualquer link válido. Membro ativo que abre link antigo (expirado/revogado) apenas volta para o grupo.
- Quem sai (ou é removido) mantém seus lançamentos já marcados no histórico do grupo; suas recorrentes marcadas para o grupo deixam de ser do grupo (`group_id` → nulo). Excluir o grupo deixa `group_id` nulo nos lançamentos e recorrentes (o dinheiro de cada um não muda).
- Mudar só `group_id` de um lançamento nunca regenera parcelas nem esbarra no bloqueio de fatura paga.
- Competência no grupo igual à pessoal: compra no cartão conta parcela a parcela (`month_entries`).
- Implementadores não rodam `db push`; o controlador faz dry-run em transação, aplica e roda `npm run test:db`.
- Fora desta etapa: orçamento do grupo (Etapa 6), relatórios comparativos (Etapa 6), notificações push.

---

### Task 1: Banco — grupos, membros, convites, `group_id` + testes

**Files:** Create `supabase/migrations/20261014000001_groups.sql`, `supabase/tests/05_groups.sql`

**Interfaces (produz):**
- Tabelas `groups(id, name, currency, icon, created_by, created_at, updated_at)` (cliente só atualiza `name, icon` se admin; exclui se admin), `group_members(group_id, user_id, role, joined_at, left_at)` (só leitura via RPC), `group_invites(id, group_id, token, created_by, expires_at, revoked_at, created_at)` (admin lê).
- `transactions.group_id`, `recurring.group_id` (`uuid null`, graváveis no insert/update). `month_entries` ganha `group_id` no fim.
- RPCs (todas para `authenticated`): `create_group(p_name text, p_currency text, p_icon text) returns uuid`; `my_groups() returns table(id, name, currency, icon, role, members int, created_at)`; `group_member_list(p_group uuid) returns table(user_id, name, role, joined_at, left_at)`; `group_month_entries(p_group uuid, p_month date) returns table(entry_id, transaction_id, user_id, kind, amount, currency, date, category_id, category_name, category_key, category_icon, category_color, description, is_card, installment_number, installments_count, created_at)`; `create_group_invite(p_group uuid) returns public.group_invites`; `revoke_group_invite(p_invite uuid) returns void`; `group_invite_preview(p_token text) returns table(group_id, name, icon, currency, members int, expires_at, status text)` com `status in ('valid','expired','removed','member')` (sem linha = convite inexistente); `join_group(p_token text) returns uuid`; `leave_group(p_group uuid) returns void`; `remove_member(p_group uuid, p_user uuid) returns void`; `transfer_admin(p_group uuid, p_user uuid) returns void`.
- Auxiliares: `is_group_member(uuid) → boolean`, `is_group_admin(uuid) → boolean`, `group_currency(uuid) → char(3)` (todas `security definer`, `stable`, executáveis por `authenticated`).

- [ ] **Step 1: Migration** (escrever exatamente; corrigir só bugs encontrados no dry-run, registrando no relatório):

```sql
-- Etapa 5: grupos, convites e lançamentos compartilhados
-- Leituras do grupo passam por funções security definer: o RLS das tabelas pessoais continua "só o dono".

------------------------------------------------------------
-- Grupos e membros
------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  currency char(3) not null
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  icon text not null default 'users' check (icon ~ '^[a-z0-9-]{1,40}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  removed boolean not null default false,
  primary key (group_id, user_id),
  constraint group_members_admin_active check (role = 'member' or left_at is null)
);
create index group_members_user_idx on public.group_members (user_id) where left_at is null;
create unique index group_members_one_admin on public.group_members (group_id) where role = 'admin';

create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid()) and m.left_at is null
  )
$$;

create function public.is_group_admin(p_group uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid()) and m.left_at is null and m.role = 'admin'
  )
$$;

-- Moeda do grupo (inclusive para quem já saiu: usado na validação de lançamentos antigos).
create function public.group_currency(p_group uuid) returns char(3)
language sql stable security definer set search_path = ''
as $$ select g.currency from public.groups g where g.id = p_group $$;

revoke execute on function public.is_group_member(uuid), public.is_group_admin(uuid), public.group_currency(uuid)
  from public, anon;
grant execute on function public.is_group_member(uuid), public.is_group_admin(uuid), public.group_currency(uuid)
  to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy groups_select_member on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy groups_update_admin on public.groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy groups_delete_admin on public.groups for delete to authenticated
  using (public.is_group_admin(id));
create policy group_members_select_member on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

revoke all on public.groups, public.group_members from anon, authenticated;
grant select, delete on public.groups to authenticated;
grant update (name, icon) on public.groups to authenticated;
grant select on public.group_members to authenticated;

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- Convites
------------------------------------------------------------
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_invites_group_idx on public.group_invites (group_id);

alter table public.group_invites enable row level security;
create policy group_invites_select_admin on public.group_invites for select to authenticated
  using (public.is_group_admin(group_id));
revoke all on public.group_invites from anon, authenticated;
grant select on public.group_invites to authenticated;

------------------------------------------------------------
-- Lançamentos e recorrentes podem ser do grupo
------------------------------------------------------------
alter table public.transactions
  add column group_id uuid references public.groups (id) on delete set null;
create index transactions_group_date_idx on public.transactions (group_id, date) where group_id is not null;
grant insert (group_id), update (group_id) on public.transactions to authenticated;

alter table public.recurring
  add column group_id uuid references public.groups (id) on delete set null;
grant insert (group_id), update (group_id) on public.recurring to authenticated;

-- Só mudanças que mexem no dinheiro regeneram parcelas ou esbarram em fatura paga
-- (assim, marcar/desmarcar grupo, excluir o grupo ou a recorrente não falham em compra de fatura paga).
drop trigger transactions_guard_paid on public.transactions;
create trigger transactions_guard_paid
  before update of kind, amount, date, category_id, description, account_id, card_id, installments_count or delete
  on public.transactions
  for each row execute function public.transactions_guard_paid();

drop trigger transactions_sync_installments on public.transactions;
create trigger transactions_sync_installments
  after insert or update of kind, amount, date, account_id, card_id, installments_count
  on public.transactions
  for each row execute function public.transactions_sync_installments();

-- Validação dos lançamentos: como antes + grupo (membro ativo e mesma moeda).
create or replace function public.transactions_validate() returns trigger
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
    select a.user_id, a.currency into src_user, src_currency from public.accounts a where a.id = new.account_id;
  else
    select c.user_id, c.currency, c.archived into src_user, src_currency, src_archived
      from public.cards c where c.id = new.card_id;
  end if;
  if src_user is null or src_user <> new.user_id then
    raise exception 'origem inválida' using errcode = '23514';
  end if;
  -- Compras novas (ou movidas) não podem ir para cartão arquivado.
  if src_archived then
    if tg_op = 'INSERT' then
      raise exception 'cartão arquivado' using errcode = '23514', hint = 'archived_card';
    elsif new.card_id is distinct from old.card_id then
      raise exception 'cartão arquivado' using errcode = '23514', hint = 'archived_card';
    end if;
  end if;

  select c.user_id, c.kind into cat_user, cat_kind from public.categories c where c.id = new.category_id;
  if cat_kind is null or (cat_user is not null and cat_user <> new.user_id) then
    raise exception 'categoria inválida' using errcode = '23514';
  end if;
  if cat_kind <> new.kind then
    raise exception 'tipo da categoria diferente do lançamento' using errcode = '23514';
  end if;

  new.currency := src_currency;

  if new.group_id is not null then
    if tg_op = 'INSERT' or new.group_id is distinct from old.group_id then
      if not exists (select 1 from public.group_members m
                     where m.group_id = new.group_id and m.user_id = new.user_id and m.left_at is null) then
        raise exception 'não é membro do grupo' using errcode = '23514', hint = 'not_group_member';
      end if;
    end if;
    if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id
        or new.account_id is distinct from old.account_id or new.card_id is distinct from old.card_id)
       and public.group_currency(new.group_id) is distinct from new.currency then
      raise exception 'moeda diferente da do grupo' using errcode = '23514', hint = 'group_currency';
    end if;
  end if;
  return new;
end;
$$;

-- Validação das recorrentes: como antes + grupo.
create or replace function public.recurring_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src_user uuid;
  src_currency char(3);
  src_archived boolean;
  cat_user uuid;
  cat_kind text;
  v_d date;
  v_i integer;
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

  if new.group_id is not null then
    if tg_op = 'INSERT' or new.group_id is distinct from old.group_id then
      if not exists (select 1 from public.group_members m
                     where m.group_id = new.group_id and m.user_id = new.user_id and m.left_at is null) then
        raise exception 'não é membro do grupo' using errcode = '23514', hint = 'not_group_member';
      end if;
    end if;
    if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id
        or new.account_id is distinct from old.account_id or new.card_id is distinct from old.card_id)
       and public.group_currency(new.group_id) is distinct from new.currency then
      raise exception 'moeda diferente da do grupo' using errcode = '23514', hint = 'group_currency';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.next_date := new.start_date;
  else
    -- Troca de frequência: primeira ocorrência da nova agenda (ancorada no início) a partir da próxima data
    if new.frequency is distinct from old.frequency then
      v_d := old.start_date;
      v_i := 0;
      while v_d < old.next_date and v_i < 6000 loop
        v_d := public.recurring_next(v_d, new.frequency, old.start_date);
        v_i := v_i + 1;
      end loop;
      new.next_date := v_d;
    end if;
    -- Retomada: não gera o período pausado; avança até hoje
    if old.paused and not new.paused then
      v_d := new.next_date;
      v_i := 0;
      while v_d < current_date and v_i < 6000 loop
        v_d := public.recurring_next(v_d, new.frequency, old.start_date);
        v_i := v_i + 1;
      end loop;
      new.next_date := v_d;
    end if;
  end if;
  return new;
end;
$$;

-- Geração das recorrentes: igual à da Etapa 4, copiando o grupo.
create or replace function public.generate_recurring_for(p_user uuid, p_until date) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next date;
  v_archived boolean;
  v_created integer := 0;
  v_count integer;
  v_guard integer;
begin
  for r in
    select * from public.recurring
    where not paused and next_date <= p_until
      and (end_date is null or next_date <= end_date)
      and (p_user is null or user_id = p_user)
    order by id
    for update skip locked
  loop
    begin
      v_count := 0;
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
           recurring_id, recurring_date, group_id)
        values
          (r.user_id, r.kind, r.amount, v_next, r.category_id, r.description, r.account_id, r.card_id, 1,
           r.id, v_next, r.group_id)
        on conflict (recurring_id, recurring_date) where recurring_id is not null do nothing;
        if found then
          v_count := v_count + 1;
        end if;
        v_next := public.recurring_next(v_next, r.frequency, r.start_date);
        v_guard := v_guard + 1;
      end loop;

      update public.recurring set next_date = v_next where id = r.id;
      v_created := v_created + v_count;
    exception when others then
      -- uma recorrente com problema não interrompe as demais (o bloco desfaz só o que ela fez), mas fica registrada
      raise warning 'recorrente %: %', r.id, sqlerrm;
    end;
  end loop;
  return v_created;
end;
$$;
revoke execute on function public.generate_recurring_for(uuid, date) from public, anon, authenticated;

-- Competência: expõe group_id (no fim)
create or replace view public.month_entries with (security_invoker = true) as
select
  t.id as entry_id, t.id as transaction_id, t.user_id, t.kind, t.amount, t.currency,
  date_trunc('month', t.date)::date as month, t.date, t.date as purchase_date,
  t.category_id, t.description, t.account_id, t.card_id,
  1::smallint as installment_number, t.installments_count, t.amount as total_amount, t.created_at,
  t.recurring_id, t.group_id
from public.transactions t
where t.card_id is null
union all
select
  i.id, t.id, t.user_id, t.kind, i.amount, t.currency,
  i.competence_month, (t.date + make_interval(months => i.number - 1))::date, t.date,
  t.category_id, t.description, t.account_id, t.card_id,
  i.number, t.installments_count, t.amount, t.created_at,
  t.recurring_id, t.group_id
from public.installments i
join public.transactions t on t.id = i.transaction_id;

------------------------------------------------------------
-- Funções de grupo (escrita)
------------------------------------------------------------
create function public.create_group(p_name text, p_currency text, p_icon text default 'users') returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'sem usuário' using errcode = '42501';
  end if;
  insert into public.groups (name, currency, icon, created_by)
    values (btrim(p_name), p_currency, coalesce(p_icon, 'users'), v_uid)
    returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

create function public.create_group_invite(p_group uuid) returns public.group_invites
language plpgsql security definer set search_path = ''
as $$
declare
  v public.group_invites;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  insert into public.group_invites (group_id, created_by) values (p_group, auth.uid()) returning * into v;
  return v;
end;
$$;

create function public.revoke_group_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.group_invites where id = p_invite;
  if v_group is null or not public.is_group_admin(v_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  update public.group_invites set revoked_at = now() where id = p_invite and revoked_at is null;
end;
$$;

create function public.join_group(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v record;
begin
  if v_uid is null then
    raise exception 'sem usuário' using errcode = '42501';
  end if;
  select i.group_id, i.expires_at, i.revoked_at, i.created_at into v from public.group_invites i where i.token = p_token;
  if not found then
    raise exception 'convite inválido' using errcode = '23514', hint = 'invite_invalid';
  end if;
  -- quem já é membro ativo volta para o grupo, mesmo com link antigo
  if exists (select 1 from public.group_members
             where group_id = v.group_id and user_id = v_uid and left_at is null) then
    return v.group_id;
  end if;
  if v.revoked_at is not null or v.expires_at <= now() then
    raise exception 'convite expirado' using errcode = '23514', hint = 'invite_expired';
  end if;
  -- trava o grupo: contagem de membros consistente
  perform 1 from public.groups where id = v.group_id for update;
  -- removido pelo admin só volta com link criado depois da remoção
  if exists (select 1 from public.group_members
             where group_id = v.group_id and user_id = v_uid and removed and v.created_at <= left_at) then
    raise exception 'removido do grupo' using errcode = '23514', hint = 'removed_from_group';
  end if;
  if (select count(*) from public.group_members where group_id = v.group_id and left_at is null) >= 50 then
    raise exception 'grupo cheio' using errcode = '23514', hint = 'group_full';
  end if;
  insert into public.group_members (group_id, user_id, role) values (v.group_id, v_uid, 'member')
  on conflict (group_id, user_id) do update set left_at = null, removed = false, joined_at = now(), role = 'member';
  return v.group_id;
end;
$$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  select role into v_role from public.group_members
    where group_id = p_group and user_id = v_uid and left_at is null for update;
  if not found then
    raise exception 'não é membro' using errcode = '23514', hint = 'not_member';
  end if;
  if v_role = 'admin' then
    raise exception 'admin precisa transferir' using errcode = '23514', hint = 'admin_must_transfer';
  end if;
  update public.group_members set left_at = now() where group_id = p_group and user_id = v_uid;
  update public.recurring set group_id = null where user_id = v_uid and group_id = p_group;
end;
$$;

create function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  if p_user = auth.uid() then
    raise exception 'não pode remover a si mesmo' using errcode = '23514', hint = 'cannot_remove_self';
  end if;
  update public.group_members set left_at = now(), removed = true
    where group_id = p_group and user_id = p_user and left_at is null;
  if not found then
    raise exception 'não é membro' using errcode = '23514', hint = 'not_member';
  end if;
  update public.recurring set group_id = null where user_id = p_user and group_id = p_group;
end;
$$;

create function public.transfer_admin(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  if p_user = auth.uid() or not exists (
      select 1 from public.group_members where group_id = p_group and user_id = p_user and left_at is null) then
    raise exception 'não é membro' using errcode = '23514', hint = 'not_member';
  end if;
  -- rebaixa antes de promover (índice de um admin por grupo)
  update public.group_members set role = 'member' where group_id = p_group and user_id = auth.uid();
  update public.group_members set role = 'admin' where group_id = p_group and user_id = p_user;
end;
$$;

------------------------------------------------------------
-- Funções de grupo (leitura) — nunca expõem contas ou cartões
------------------------------------------------------------
create function public.my_groups()
returns table (id uuid, name text, currency char(3), icon text, role text, members integer, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.currency, g.icon, m.role,
    (select count(*)::int from public.group_members x where x.group_id = g.id and x.left_at is null),
    g.created_at
  from public.groups g
  join public.group_members m on m.group_id = g.id
  where m.user_id = (select auth.uid()) and m.left_at is null
  order by lower(g.name), g.id
$$;

create function public.group_member_list(p_group uuid)
returns table (user_id uuid, name text, role text, joined_at timestamptz, left_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, coalesce(p.name, ''), m.role, m.joined_at, m.left_at
  from public.group_members m
  left join public.profiles p on p.id = m.user_id
  where m.group_id = p_group and public.is_group_member(p_group)
  order by m.left_at nulls first, m.role, m.joined_at
$$;

create function public.group_month_entries(p_group uuid, p_month date)
returns table (
  entry_id uuid, transaction_id uuid, user_id uuid, kind text, amount bigint, currency char(3), date date,
  category_id uuid, category_name text, category_key text, category_icon text, category_color text,
  description text, is_card boolean, installment_number smallint, installments_count smallint,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select e.entry_id, e.transaction_id, e.user_id, e.kind, e.amount, e.currency, e.date,
    c.id, c.name, c.i18n_key, c.icon, c.color,
    e.description, e.card_id is not null, e.installment_number, e.installments_count, e.created_at
  from public.month_entries e
  join public.categories c on c.id = e.category_id
  where e.group_id = p_group
    and e.month = date_trunc('month', p_month)::date
    and public.is_group_member(p_group)
  order by e.date desc, e.created_at desc, e.entry_id
$$;

create function public.group_invite_preview(p_token text)
returns table (group_id uuid, name text, icon text, currency char(3), members integer, expires_at timestamptz, status text)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.icon, g.currency,
    (select count(*)::int from public.group_members m where m.group_id = g.id and m.left_at is null),
    i.expires_at,
    case
      when exists (select 1 from public.group_members m
                   where m.group_id = g.id and m.user_id = (select auth.uid()) and m.left_at is null) then 'member'
      when i.revoked_at is not null or i.expires_at <= now() then 'expired'
      when exists (select 1 from public.group_members m
                   where m.group_id = g.id and m.user_id = (select auth.uid()) and m.removed
                     and i.created_at <= m.left_at) then 'removed'
      else 'valid'
    end
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.token = p_token and (select auth.uid()) is not null
$$;

revoke execute on function
  public.create_group(text, text, text), public.create_group_invite(uuid), public.revoke_group_invite(uuid),
  public.join_group(text), public.leave_group(uuid), public.remove_member(uuid, uuid), public.transfer_admin(uuid, uuid),
  public.my_groups(), public.group_member_list(uuid), public.group_month_entries(uuid, date),
  public.group_invite_preview(text)
  from public, anon;
grant execute on function
  public.create_group(text, text, text), public.create_group_invite(uuid), public.revoke_group_invite(uuid),
  public.join_group(text), public.leave_group(uuid), public.remove_member(uuid, uuid), public.transfer_admin(uuid, uuid),
  public.my_groups(), public.group_member_list(uuid), public.group_month_entries(uuid, date),
  public.group_invite_preview(text)
  to authenticated;
```

- [ ] **Step 2: Testes** `supabase/tests/05_groups.sql` no mesmo estilo de `supabase/tests/04_recurring.sql` (transação com `rollback` no fim, usuários fictícios `...a5`, `...b5`, `...c5` em `auth.users`, troca de usuário com `set local request.jwt.claims`, tabela temporária `ids`, cada falha `raise exception 'FAIL: …'`, última linha `select 'PASS' as result;`). Casos obrigatórios:
  1. A cria G (BRL) com `create_group` → A é admin; `my_groups()` de A devolve G com `members = 1`.
  2. B (não membro): `select count(*) from groups` = 0; `group_member_list(G)` e `group_month_entries(G, mês)` vazios; `create_group_invite(G)` falha com hint `not_admin`; `insert into group_members` e `update groups set currency` falham por permissão (`42501`).
  3. A cria convite; B vê `group_invite_preview(token)` com `status = 'valid'` e o nome; `join_group` → B membro; preview de B agora `'member'`; `my_groups()` de B mostra `members = 2`; `join_group` de novo não duplica.
  4. Mesmo membro, B continua sem ver contas/lançamentos de A (`select count(*) from accounts/transactions` só os próprios).
  5. A lança em conta BRL com `group_id = G` → ok; A lança em conta EUR com G → hint `group_currency`; C (não membro) lança com G → hint `not_group_member`.
  6. B compra no cartão BRL em 3x com G → `group_month_entries` (visto por A) no mês da compra traz a 1ª parcela com `is_card = true`, valor da parcela, nome/ícone/cor da categoria; no mês seguinte a 2ª parcela. As colunas não incluem `account_id`/`card_id`.
  7. Recorrente de A com `group_id = G` gerada como A via `generate_my_recurring()` (início no passado recente) → lançamento gerado tem `group_id = G`.
  8. B tem recorrente com G; B `leave_group(G)` → recorrente de B fica com `group_id` nulo; lançamentos antigos de B continuam em `group_month_entries` visto por A; B passa a ver `group_month_entries` vazio; B consegue alterar a descrição de um lançamento antigo do grupo; B lança novo com G → `not_group_member`.
  9. A `leave_group(G)` → `admin_must_transfer`. B volta com o mesmo convite (`left_at` nulo de novo). B `remove_member` → `not_admin`; A `remove_member(G, A)` → `cannot_remove_self`. A `transfer_admin(G, B)` → B admin, A member (um admin só); A agora consegue sair.
  10. B (admin agora) revoga o convite → `join_group` com ele → `invite_expired`; convite com `expires_at` no passado (alterado como `postgres` via `reset role`) → `invite_expired`; token inexistente → `invite_invalid`; preview de token inexistente → 0 linhas.
  11. Regressão dos gatilhos: B paga (`pay_invoice`) a fatura que contém a 1ª parcela da compra do grupo; B marca/desmarca o grupo dessa compra (só `group_id`) → ok e as parcelas continuam as mesmas (mesmos `invoice_id`); alterar o valor dela continua bloqueado (`paid_invoice`).
  12. Não admin tenta `delete from groups where id = G` → 0 linhas e G continua; admin exclui G → lançamentos e recorrentes ficam com `group_id` nulo (incluindo a compra em fatura paga) e continuam existindo.
- [ ] **Step 3:** Não rodar `db push`. Commit (`feat: banco de grupos, convites e lançamentos do grupo`). O controlador faz o dry-run, aplica e roda `npm run test:db`.

---

### Task 2: Banco — tempo real por canais privados + testes

**Files:** Create `supabase/migrations/20261014000002_realtime_broadcast.sql`, `supabase/tests/06_realtime.sql`

**Interfaces (produz):**
- Tópicos privados: `user:<uuid>` (mudanças do próprio usuário em `transactions`, `invoices`, `cards`, `recurring`, `accounts`, e de sua participação em grupos) e `group:<uuid>` (lançamentos marcados para o grupo e mudanças de membros/grupo). Evento `changed`, payload `{ "table": <tabela>, "op": <INSERT|UPDATE|DELETE> }` (sem dados).
- `realtime_can_listen(p_topic text) returns boolean`.
- As tabelas saem da publicação `supabase_realtime` (`postgres_changes` deixa de ser usado).

- [ ] **Step 1: Migration** (exatamente; se `realtime.send` não existir no projeto, o dry-run mostra e o controlador decide):

```sql
-- Tempo real por canais privados: cada pessoa ouve só "user:<seu id>" e "group:<id>" dos grupos em que está.
-- Substitui postgres_changes (cujo DELETE sem filtro entregava chaves de registros de outros usuários).

create function public.realtime_can_listen(p_topic text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  if p_topic = 'user:' || (select auth.uid())::text then
    return true;
  end if;
  if p_topic ~ '^group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.is_group_member(substr(p_topic, 7)::uuid);
  end if;
  return false;
end;
$$;
revoke execute on function public.realtime_can_listen(text) from public, anon;
grant execute on function public.realtime_can_listen(text) to authenticated;

create policy finance_private_listen on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.realtime_can_listen((select realtime.topic())));

-- Envia um aviso sem dados; falha no envio nunca desfaz a escrita.
create function public.notify_topic(p_topic text, p_table text, p_op text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('table', p_table, 'op', p_op), 'changed', p_topic, true);
exception when others then
  raise warning 'realtime %: %', p_topic, sqlerrm;
end;
$$;
revoke execute on function public.notify_topic(text, text, text) from public, anon, authenticated;

create function public.broadcast_owner_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  perform public.notify_topic('user:' || v_user::text, tg_table_name, tg_op);
  if tg_table_name = 'transactions' then
    if tg_op <> 'INSERT' and old.group_id is not null then
      perform public.notify_topic('group:' || old.group_id::text, tg_table_name, tg_op);
    end if;
    if tg_op <> 'DELETE' and new.group_id is not null
       and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id) then
      perform public.notify_topic('group:' || new.group_id::text, tg_table_name, tg_op);
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.broadcast_owner_change() from public, anon, authenticated;

create trigger transactions_broadcast after insert or update or delete on public.transactions
  for each row execute function public.broadcast_owner_change();
create trigger invoices_broadcast after insert or update or delete on public.invoices
  for each row execute function public.broadcast_owner_change();
create trigger cards_broadcast after insert or update or delete on public.cards
  for each row execute function public.broadcast_owner_change();
create trigger recurring_broadcast after insert or update or delete on public.recurring
  for each row execute function public.broadcast_owner_change();
create trigger accounts_broadcast after insert or update or delete on public.accounts
  for each row execute function public.broadcast_owner_change();

create function public.broadcast_group_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'group_members' then
    perform public.notify_topic('group:' || coalesce(new.group_id, old.group_id)::text, tg_table_name, tg_op);
    perform public.notify_topic('user:' || coalesce(new.user_id, old.user_id)::text, tg_table_name, tg_op);
  else
    perform public.notify_topic('group:' || coalesce(new.id, old.id)::text, tg_table_name, tg_op);
  end if;
  return null;
end;
$$;
revoke execute on function public.broadcast_group_change() from public, anon, authenticated;

create trigger group_members_broadcast after insert or update or delete on public.group_members
  for each row execute function public.broadcast_group_change();
create trigger groups_broadcast after update or delete on public.groups
  for each row execute function public.broadcast_group_change();

alter publication supabase_realtime drop table public.transactions, public.invoices, public.cards, public.recurring;
```

- [ ] **Step 2: Testes** `supabase/tests/06_realtime.sql` (mesmo estilo): `realtime_can_listen` verdadeiro para `user:<A>` como A e falso para `user:<B>`; `group:<G>` verdadeiro para membro, falso para não membro, falso depois de sair; falso para `group:xyz`, `group:<uuid inexistente>`, `''` e sem usuário (`request.jwt.claims` vazio); a policy `finance_private_listen` existe em `pg_policies` (schema `realtime`, tabela `messages`); `pg_publication_tables` de `supabase_realtime` não contém mais `transactions`, `invoices`, `cards`, `recurring`; inserir/alterar/excluir conta, cartão, lançamento (com e sem grupo), recorrente e membro de grupo não gera erro.
- [ ] **Step 3:** Não rodar `db push`. Commit (`feat: tempo real por canais privados de usuário e de grupo`).

---

### Task 3: Traduções da Etapa 5

**Files:** `src/i18n/locales/{pt-BR,pt-PT,en,es}.json`

pt-BR (mesclar; `nav.groups` já existe):

```json
{
  "groups": {
    "title": "Grupos",
    "subtitle": "Some os gastos com quem mora, viaja ou divide contas com você. Cada pessoa continua vendo só os próprios detalhes.",
    "new": "Novo grupo", "create": "Criar grupo", "name": "Nome do grupo", "currency": "Moeda do grupo",
    "currencyHint": "Só lançamentos nessa moeda podem ir para o grupo. Não dá para mudar depois.",
    "icon": "Ícone",
    "empty": "Nenhum grupo ainda",
    "emptyBody": "Crie um grupo ou entre por um convite para somar os gastos com outras pessoas.",
    "members_one": "{{count}} membro", "members_other": "{{count}} membros",
    "admin": "Administrador", "you": "Você", "left": "Saiu", "unnamed": "Membro sem nome",
    "monthTotal": "Gasto do grupo no mês", "yourPart": "Sua parte: {{amount}} ({{pct}}%)",
    "byMember": "Quem gastou quanto", "byCategory": "Por categoria", "share": "{{pct}}% do total",
    "entries": "Lançamentos do grupo", "entriesEmpty": "Nenhum lançamento do grupo neste mês.",
    "entriesHint": "Para um gasto aparecer aqui, escolha este grupo ao lançar.",
    "membersTitle": "Membros",
    "invite": "Convidar", "inviteTitle": "Convidar para o grupo",
    "inviteBody": "Quem abrir este link entra no grupo. Ele vale por 7 dias e pode ser usado por várias pessoas.",
    "copyLink": "Copiar link", "copied": "Link copiado", "share_action": "Compartilhar",
    "shareText": "Entre no meu grupo \"{{name}}\" no FINANCE",
    "expiresOn": "Vale até {{date}}", "activeInvites": "Links ativos", "revoke": "Revogar", "newInvite": "Gerar novo link",
    "settings": "Ajustes do grupo", "save": "Salvar",
    "delete": "Excluir grupo",
    "deleteConfirm": "Excluir o grupo? Os lançamentos continuam com cada pessoa, só deixam de fazer parte do grupo.",
    "leave": "Sair do grupo",
    "leaveConfirm": "Sair do grupo? Os lançamentos que você já marcou continuam no histórico do grupo.",
    "remove": "Remover do grupo",
    "removeConfirm": "Remover {{name}} do grupo? Os lançamentos já feitos continuam no histórico.",
    "makeAdmin": "Tornar administrador",
    "makeAdminConfirm": "Passar a administração para {{name}}? Você continua no grupo como membro.",
    "adminMustTransfer": "Para sair, passe a administração a outro membro ou exclua o grupo.",
    "notAdmin": "Só o administrador pode fazer isso.",
    "notMember": "Você não faz parte deste grupo.",
    "groupCurrency": "A moeda deste lançamento é diferente da moeda do grupo.",
    "field": "Grupo", "none": "Nenhum", "formerGroup": "Grupo anterior",
    "groupCurrencyHint": "Só grupos em {{currency}} aceitam este lançamento.",
    "badge": "Do grupo",
    "privacyNote": "O grupo vê só os lançamentos que você marcar para ele — nunca suas contas, cartões ou outros gastos.",
    "notFound": "Grupo não encontrado.",
    "join": {
      "title": "Convite para grupo", "body": "Você foi convidado para entrar em",
      "action": "Entrar no grupo", "joined": "Você entrou no grupo.",
      "invalid": "Este convite não existe. Peça um novo link a quem convidou você.",
      "expired": "Este convite expirou ou foi revogado. Peça um novo link a quem convidou você.",
      "already": "Você já faz parte deste grupo.", "open": "Abrir grupo",
      "full": "Este grupo já tem o máximo de 50 membros.",
      "removed": "Você foi removido deste grupo. Para voltar, peça um novo link ao administrador."
    }
  }
}
```

en: "Groups", "Add up spending with the people you live, travel or split bills with. Everyone still sees only their own details.", "New group", "Create group", "Group name", "Group currency", "Only entries in this currency can go to the group. It can't be changed later.", "Icon", "No groups yet", "Create a group or join through an invite to add up spending with other people.", "{{count}} member"/"{{count}} members", "Admin", "You", "Left", "Unnamed member", "Group spending this month", "Your part: {{amount}} ({{pct}}%)", "Who spent what", "By category", "{{pct}}% of total", "Group entries", "No group entries this month.", "To show an expense here, pick this group when you add it.", "Members", "Invite", "Invite to the group", "Anyone who opens this link joins the group. It's valid for 7 days and can be used by several people.", "Copy link", "Link copied", "Share", "Join my group \"{{name}}\" on FINANCE", "Valid until {{date}}", "Active links", "Revoke", "Create new link", "Group settings", "Save", "Delete group", "Delete the group? Entries stay with each person; they just stop being part of the group.", "Leave group", "Leave the group? Entries you already marked stay in the group's history.", "Remove from group", "Remove {{name}} from the group? Entries already made stay in the history.", "Make admin", "Hand over admin to {{name}}? You stay in the group as a member.", "To leave, hand over admin to another member or delete the group.", "Only the admin can do this.", "You're not part of this group.", "This entry's currency is different from the group's currency.", "Group", "None", "Previous group", "Only groups in {{currency}} accept this entry.", "Group", "The group only sees the entries you mark for it — never your accounts, cards or other spending.", "Group not found."; join: "Group invite", "You've been invited to join", "Join group", "You joined the group.", "This invite doesn't exist. Ask whoever invited you for a new link.", "This invite expired or was revoked. Ask whoever invited you for a new link.", "You're already part of this group.", "Open group", "This group already has the maximum of 50 members.", "You were removed from this group. To come back, ask the admin for a new link." (join.removed). pt-PT e es: traduzir seguindo o padrão dos arquivos (pt-PT: "registar", "partilhar", "Convite para o grupo"; es: "Grupos", "Compartir"; `{{…}}` idênticos; plurais `_one/_other` em todos).

- [ ] `npm test` (paridade) e commit (`feat: traduções da etapa 5 (grupos)`).

---

### Task 4: Dados — API de grupos, `group_id` nos tipos, estatísticas e tempo real

**Files:** Create `src/features/groups/{types,api,stats,stats.test}.ts`, `src/lib/return-to.ts`, `src/lib/return-to.test.ts`; Modify `src/features/transactions/{types,api}.ts` (+ `group_id`), `src/features/recurring/types.ts` (+ `group_id`), testes/fixtures que montam `Transaction`/`Recurring` (ex.: `src/features/transactions/series.test.ts`, `src/features/home/upcoming.test.ts`), `src/lib/realtime.ts` (reescrever), `scripts/capture-screens.mjs` só se quebrar.

**Interfaces (produz):**

```ts
// src/features/groups/types.ts
import type { CurrencyCode } from '../../lib/money'
import type { TransactionKind } from '../transactions/types'
export type GroupRole = 'admin' | 'member'
export type Group = { id: string; name: string; currency: CurrencyCode; icon: string; role: GroupRole; members: number; created_at: string }
export type GroupMember = { user_id: string; name: string; role: GroupRole; joined_at: string; left_at: string | null }
export type GroupEntry = {
  entry_id: string; transaction_id: string; user_id: string; kind: TransactionKind; amount: number; currency: CurrencyCode
  date: string; category_id: string; category_name: string | null; category_key: string | null
  category_icon: string; category_color: string; description: string; is_card: boolean
  installment_number: number; installments_count: number; created_at: string
}
export type GroupInvite = { id: string; group_id: string; token: string; expires_at: string; revoked_at: string | null; created_at: string }
export type InvitePreview = { group_id: string; name: string; icon: string; currency: CurrencyCode; members: number; expires_at: string; status: 'valid' | 'expired' | 'member' }
export type GroupInput = { name: string; currency: CurrencyCode; icon: string }
```

- `api.ts` (padrão de `src/features/recurring/api.ts`; `amount`/`members` com `Number()`):
  - `useMyGroups()` → key `['groups', uid, 'list']`, `rpc('my_groups')`.
  - `useGroupMembers(groupId)` → `['groups', uid, groupId, 'members']`, `rpc('group_member_list', { p_group })`.
  - `useGroupEntries(groupId, month /* 'YYYY-MM' */)` → `['groups', uid, groupId, 'entries', month]`, `rpc('group_month_entries', { p_group, p_month: \`${month}-01\` })`.
  - `useGroupInvites(groupId, enabled)` → `['groups', uid, groupId, 'invites']`, `from('group_invites').select('*').eq('group_id', id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })`.
  - `useInvitePreview(token)` → `['groups', uid, 'invite', token]`, devolve `InvitePreview | null` (sem linha → `null`).
  - Mutações: `useCreateGroup()` (`rpc('create_group', { p_name, p_currency, p_icon })` → id), `useUpdateGroup()` (`{ id, patch: { name?, icon? } }` via `from('groups').update`), `useDeleteGroup()` (`mutate(id)`), `useCreateInvite()` (`mutate(groupId)` → `GroupInvite`), `useRevokeInvite()` (`mutate(inviteId)`), `useJoinGroup()` (`mutate(token)` → group id), `useLeaveGroup()` (`mutate(groupId)`), `useRemoveMember()` (`{ groupId, userId }`), `useTransferAdmin()` (`{ groupId, userId }`). Todas invalidam `['groups']`; excluir/sair/remover também invalidam `['transactions']` e `['recurring']`.
  - `inviteUrl(token: string, origin = window.location.origin): string` → `${origin}/join/${token}`.
- `stats.ts` (puro, testado):

```ts
export type MemberTotal = { user_id: string; name: string; amount: number; share: number; left: boolean }
export type CategoryTotal = { category_id: string; name: string | null; key: string | null; icon: string; color: string; amount: number }
/** Só despesas. `share` em 0..100 inteiro (arredondado). Membros ativos sem gasto entram com 0; quem saiu só aparece se gastou. Ordem: valor desc, depois nome. */
export function groupMonthStats(entries: GroupEntry[], members: GroupMember[]): { total: number; byMember: MemberTotal[]; byCategory: CategoryTotal[] }
```
  Testes: total soma só `expense`; parcela conta pelo `amount` da entrada; membro ativo sem gasto aparece com 0; membro que saiu sem gasto não aparece; que saiu com gasto aparece com `left: true`; `share` soma ~100; total 0 → `share` 0; categorias agregadas e ordenadas.
- `return-to.ts` (puro + `localStorage` com try/catch, validade de 24 h, só aceita caminhos que começam com `/join/`):

```ts
export function saveReturnTo(path: string): void
export function readReturnTo(): string | null   // não apaga
export function clearReturnTo(): void
```
  Testes: salva e lê `/join/abc`; ignora `/cards` e `https://x`; expira após 24 h (`vi.setSystemTime`); `localStorage` que lança não quebra.
- `Transaction` e `TransactionInput` ganham `group_id: string | null`; `toMonthEntry` mapeia `group_id: row.group_id ?? null`; `Recurring`, `RecurringInput` e `RecurringPatch` ganham `group_id`. Onde o app monta `TransactionInput`/`RecurringInput` hoje, mandar `group_id: null` (o seletor vem no Task 7) — exceto na edição, que preserva o valor atual.
- `src/lib/realtime.ts` reescrito (mesmo nome `useRealtimeSync`, mesmo uso no `AppShell`):

```ts
const DEBOUNCE_MS = 300
const AFFECTED_KEYS = [['transactions'], ['accounts'], ['cards'], ['invoices'], ['recurring'], ['groups']] as const

/** Canais privados: "user:<id>" e "group:<id>" de cada grupo. O banco só manda avisos sem dados. */
export function useRealtimeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id
  const groups = useMyGroups().data
  const groupKey = (groups ?? []).map((g) => g.id).sort().join(',')

  useEffect(() => {
    if (!uid) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const channels: RealtimeChannel[] = []
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        for (const queryKey of AFFECTED_KEYS) void qc.invalidateQueries({ queryKey })
      }, DEBOUNCE_MS)
    }
    const topics = [`user:${uid}`, ...groupKey.split(',').filter(Boolean).map((id) => `group:${id}`)]
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      for (const topic of topics) {
        channels.push(
          supabase.channel(topic, { config: { private: true } }).on('broadcast', { event: 'changed' }, refresh).subscribe(),
        )
      }
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
      for (const ch of channels) void supabase.removeChannel(ch)
    }
  }, [uid, groupKey, qc])
}
```

- [ ] Testes de `stats` e `return-to` primeiro (falham), implementar, `npm test`, `npm run build`, commit (`feat: API de grupos, estatísticas e tempo real por canais privados`).

---

### Task 5: Lista de grupos, criação e navegação

**Files:** Create `src/features/groups/{GroupsPage,GroupForm,GroupIcon}.tsx`; Modify `src/app/router.tsx` (`/groups` → `GroupsPage`, `/groups/:id` → placeholder até o Task 6 — usar `PlaceholderPage titleKey="groups.title"`), `src/app/nav.ts`, `scripts/capture-screens.mjs`

**Comportamento:**
- Navegação conforme a especificação §4: barra inferior do celular = Início, Lançamentos, **+**, Cartões, **Grupos** (`Users` do lucide). Contas vira `sidebarOnly` (continua no menu lateral e em Ajustes). Ordem no menu lateral: Início, Lançamentos, +, Cartões, Grupos, Contas, Categorias, Recorrentes.
- `GroupIcon`: ladrilho redondo com ícone lucide de um conjunto fixo (`users`, `home`, `heart`, `plane`, `utensils`, `party-popper`, `briefcase`, `car`, `graduation-cap`, `shopping-cart`) — reutilizar o mapa de `src/features/categories/icons.ts` quando o nome existir lá; cor de fundo `primary-soft`, ícone `primary`.
- `GroupsPage`: cabeçalho (título + subtítulo `groups.subtitle`) e botão "Novo grupo"; folha `rounded-[24px]` com a lista (cada item: `GroupIcon`, nome, `groups.members` com contagem, pílula da moeda, pílula "Administrador" quando `role = 'admin'`) levando a `/groups/:id`; estado vazio com `EmptyState` (`groups.empty`/`groups.emptyBody`) e nota de privacidade `groups.privacyNote` em texto pequeno abaixo da lista.
- `GroupForm` (em `Sheet`): nome (1–40, erro inline), moeda (`SelectField` com as moedas suportadas, padrão a moeda do perfil) com `groups.currencyHint`, grade de ícones (botões `aria-pressed`). Ao criar, navega para `/groups/<id>`. Robustez como em `AccountsPage` (botão ocupado, sem envio duplo, erro genérico).
- Mocks no `scripts/capture-screens.mjs` para `rpc/my_groups` (2 grupos: "Casa" BRL admin 3 membros, "Viagem Lisboa" EUR membro 4 membros) e shot `['groups', '/groups']`; capturar e conferir uma vez (servidor 5173: reutilizar se estiver rodando; se iniciar um, parar **só esse processo** pelo PID — nunca `taskkill /IM node.exe`).
- [ ] `npm test`, `npm run build`, `npm run e2e`, commit (`feat: lista e criação de grupos, Grupos na barra inferior`).

---

### Task 6: Tela do grupo — resumo, ranking, categorias, lançamentos, membros, convites e ajustes

**Files:** Create `src/features/groups/{GroupDetailPage,InviteSheet,GroupSettingsSheet,MemberRow}.tsx`; Modify `src/app/router.tsx` (`/groups/:id` → `GroupDetailPage`), `scripts/capture-screens.mjs`

**Comportamento:**
- Dados: grupo via `useMyGroups()` (procura por id; se a lista carregou e não tem → estado `groups.notFound` com link para `/groups`), `useGroupMembers`, `useGroupEntries(id, month)` com `MonthSwitcher` (mesmo componente/estado de mês do extrato), `groupMonthStats`.
- Cabeçalho: voltar, `GroupIcon` grande, nome, `groups.members`, pílula da moeda; ações: "Convidar" (só admin; abre `InviteSheet`) e botão de ajustes (abre `GroupSettingsSheet`).
- Folha de resumo: `groups.monthTotal` com `Amount` grande na moeda do grupo e linha `groups.yourPart` (valor via `Amount`; quando valores ocultos, o `Amount` já mascara — não montar o valor como texto puro).
- "Quem gastou quanto": uma linha por `MemberTotal` — nome (ou `groups.you` para o próprio; `groups.unnamed` se vazio), pílula `groups.left` se saiu, `Amount`, barra horizontal proporcional (`share`) em `primary` (o próprio usuário) ou `surface-3`/`muted` (demais), texto `groups.share`.
- "Por categoria": como a lista de categorias do Início (ícone com cor, nome via `categoryLabel` de `src/features/categories/label.ts` montando o objeto a partir de `category_name`/`category_key`, valor, barra).
- "Lançamentos do grupo": lista por data com `CategoryIcon`, descrição ou categoria, linha secundária "<membro> · <data curta>" + " · Cartão" quando `is_card` e " · k/n" quando parcelado, valor com `Amount` (receita em verde com +). Só os lançamentos do próprio usuário são clicáveis (→ `/transactions/<transaction_id>/edit`). Vazio: `groups.entriesEmpty` + `groups.entriesHint`.
- "Membros" (`MemberRow`): nome/`Você`, pílula `Administrador`, "Saiu" esmaecido via pílula (sem reduzir contraste do texto). Para o admin, em cada outro membro ativo: menu com "Tornar administrador" e "Remover do grupo", cada um com confirmação (`groups.makeAdminConfirm` / `groups.removeConfirm` com o nome).
- `InviteSheet` (admin): ao abrir, se não há convite ativo cria um (`useCreateInvite`); mostra o link (`inviteUrl`) em campo somente leitura, botões "Copiar link" (`navigator.clipboard.writeText`, feedback `groups.copied` por 2 s) e "Compartilhar" (só se `navigator.share` existir; texto `groups.shareText`), `groups.inviteBody`, `groups.expiresOn` (data longa via `Intl`), lista "Links ativos" com "Revogar" (confirmação) e "Gerar novo link".
- `GroupSettingsSheet`: admin edita nome e ícone (salvar), "Excluir grupo" (confirmação `groups.deleteConfirm`; ao excluir → `/groups`); membro vê "Sair do grupo" (confirmação `groups.leaveConfirm`; ao sair → `/groups`); admin que tenta sair vê `groups.adminMustTransfer` (o botão de sair do admin mostra essa explicação em vez de chamar a função). Mapear hints com `isRpcHint` (`not_admin` → `groups.notAdmin`, `admin_must_transfer` → `groups.adminMustTransfer`, `not_member` → `groups.notMember`).
- Layout: no PC (≥ 1024 px) duas colunas — esquerda resumo + quem gastou + categorias; direita lançamentos + membros. No celular, essa mesma ordem empilhada.
- Mocks em `capture-screens.mjs` para `group_member_list`, `group_month_entries` (≥ 8 entradas de 3 membros, uma parcelada no cartão, um membro que saiu), `group_invites`; shot `['group', '/groups/<id do grupo Casa>']`; capturar e conferir uma vez (parar só o próprio processo do servidor, se iniciou).
- [ ] `npm test`, `npm run build`, `npm run e2e`, commit (`feat: tela do grupo com resumo, membros e convites`).

---

### Task 7: Entrar pelo convite, grupo no lançamento e na recorrente

**Files:** Create `src/features/groups/{JoinGroupPage,GroupPicker}.tsx`; Modify `src/app/router.tsx` (`/join/:token` dentro de `RequireAuth` → `RequireOnboarded` → `AppShell`), `src/app/guards.tsx`, `src/features/auth/LoginPage.tsx`, `src/features/onboarding/OnboardingPage.tsx`, `src/features/transactions/TransactionFormPage.tsx`, `src/features/recurring/RecurringForm.tsx`, `src/features/transactions/TransactionRow.tsx`, `e2e/` (novo teste), `scripts/capture-screens.mjs`

**Comportamento:**
- Volta ao convite depois de entrar: `RequireAuth` sem sessão chama `saveReturnTo(location.pathname)` (só guarda `/join/...`) antes do `<Navigate to="/login" replace />`; `PublicOnly` com sessão navega para `readReturnTo() ?? '/'`; `LoginPage` após login navega para `readReturnTo() ?? '/'`; `OnboardingPage` ao concluir navega para `readReturnTo() ?? '/'`. `JoinGroupPage` chama `clearReturnTo()` ao montar.
- `JoinGroupPage`: carrega `useInvitePreview(token)`; mostra cartão centrado com `GroupIcon`, `groups.join.body` + nome, `groups.members`, moeda, `groups.privacyNote`, botão "Entrar no grupo" → `useJoinGroup` → navega para `/groups/<id>` (aviso `groups.join.joined`). Estados: `null` → `groups.join.invalid`; `expired` → `groups.join.expired`; `member` → `groups.join.already` + botão "Abrir grupo"; `removed` → `groups.join.removed`. Erros do `join_group` por hint: `invite_invalid`, `invite_expired`, `group_full`, `removed_from_group` → mensagens correspondentes.
- `GroupPicker` (usado nos dois formulários): oculto se a pessoa não tem grupos e o valor atual é nulo; senão linha "Grupo" com chips "Nenhum" + um por grupo (`GroupIcon` pequeno + nome). Grupos cuja moeda difere da moeda da origem escolhida ficam desabilitados e aparece `groups.groupCurrencyHint` (com a moeda da origem). Trocar a origem para uma moeda incompatível limpa a escolha. Valor atual que não está na lista (a pessoa saiu do grupo) aparece como chip selecionado `groups.formerGroup`, e "Nenhum" o remove. Sem pré-preenchimento automático de grupo (`defaults.ts` não muda).
- `TransactionFormPage` e `RecurringForm` enviam `group_id`; erros com hint `not_group_member` → `groups.notMember`, `group_currency` → `groups.groupCurrency`.
- `TransactionRow`: ícone `Users` pequeno com `aria-label` `groups.badge` quando `group_id` (ao lado do ícone de recorrente, mesmo estilo).
- E2E (visitante): abrir `/join/abc` sem sessão leva a `/login`.
- Mocks em `capture-screens.mjs` para `group_invite_preview`; shots `['join', '/join/tok-demo']` e o formulário de lançamento com o seletor (`['new', '/new']` se ainda não existir); capturar e conferir uma vez (parar só o próprio processo do servidor, se iniciou).
- [ ] Testes de componente para `GroupPicker` (desabilita moeda diferente; limpa ao trocar origem; mostra "Grupo anterior"); `npm test`, `npm run build`, `npm run e2e`, commit (`feat: entrar por convite e marcar lançamentos para o grupo`).

## Cobertura da especificação (Etapa 5)

| Requisito | Task |
|---|---|
| 3.9 Criar grupo (nome, moeda, ícone); criador é admin | 1, 5 |
| 3.9 Convite por link, 7 dias, reutilizável, revogável | 1, 6, 7 |
| 3.9 Admin remove membros; membro sai; admin só sai transferindo ou excluindo | 1, 6 |
| 3.9 Lançamentos de quem saiu continuam no histórico | 1, 6 |
| 3.9 Membros veem só lançamentos marcados para o grupo | 1 (RPCs), 2 (canais) |
| 3.9 Tela do grupo: total do mês, ranking por membro, categorias, lista | 4, 6 |
| 3.4 Categorias dos lançamentos do grupo visíveis aos membros | 1 (`group_month_entries`) |
| 3.5 / 3.8 Grupo no lançamento e na recorrente, mesma moeda, só membro | 1, 7 |
| 4 Barra inferior com Grupos; 4.9 página de convite | 5, 7 |
| 6 Entrada só via `join_group(token)` | 1, 7 |
| 7 Tempo real atualiza totais do grupo; sem vazamento de exclusões alheias | 2, 4 |

Fora desta etapa: orçamento do grupo e comparação entre membros nos relatórios (Etapa 6). Se a conta do admin for apagada, o grupo fica sem admin (tratar na Etapa 7 junto com exclusão de conta).
