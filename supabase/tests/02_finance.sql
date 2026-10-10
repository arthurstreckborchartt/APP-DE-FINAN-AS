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
