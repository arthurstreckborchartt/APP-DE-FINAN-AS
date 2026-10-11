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
