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
