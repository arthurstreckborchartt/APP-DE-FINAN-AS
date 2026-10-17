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

  select c.user_id, c.kind into cat_user, cat_kind from public.categories c where c.id = new.category_id;
  if cat_kind is distinct from 'expense' then
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
