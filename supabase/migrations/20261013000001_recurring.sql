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
  if tg_op = 'INSERT' then
    new.next_date := new.start_date;
  else
    -- Troca de frequência: primeira ocorrência da nova agenda (ancorada no início) a partir da próxima data
    if new.frequency is distinct from old.frequency then
      v_d := old.start_date;
      v_i := 0;
      while v_d < old.next_date and v_i < 1000 loop
        v_d := public.recurring_next(v_d, new.frequency, old.start_date);
        v_i := v_i + 1;
      end loop;
      new.next_date := v_d;
    end if;
    -- Retomada: não gera o período pausado; avança até hoje
    if old.paused and not new.paused then
      v_d := new.next_date;
      v_i := 0;
      while v_d < current_date and v_i < 1000 loop
        v_d := public.recurring_next(v_d, new.frequency, old.start_date);
        v_i := v_i + 1;
      end loop;
      new.next_date := v_d;
    end if;
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
           recurring_id, recurring_date)
        values
          (r.user_id, r.kind, r.amount, v_next, r.category_id, r.description, r.account_id, r.card_id, 1,
           r.id, v_next)
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
      -- uma recorrente com problema não interrompe as demais (o bloco desfaz só o que ela fez)
      null;
    end;
  end loop;
  return v_created;
end;
$$;
revoke execute on function public.generate_recurring_for(uuid, date) from public, anon, authenticated;

-- p_today: data local do usuário; limitada a ontem..amanhã para não gerar o futuro.
create function public.generate_my_recurring(p_today date default null) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1);
begin
  if auth.uid() is null then
    raise exception 'sem usuário' using errcode = '42501';
  end if;
  return public.generate_recurring_for(auth.uid(), v_day);
end;
$$;
revoke execute on function public.generate_my_recurring(date) from public, anon;
grant execute on function public.generate_my_recurring(date) to authenticated;

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
