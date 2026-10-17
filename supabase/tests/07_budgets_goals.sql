-- Orçamentos (pessoais e do grupo), metas, aportes, período do grupo e avisos em tempo real.
-- Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'rls-bud-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b7', 'rls-bud-b@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c7', 'rls-bud-c@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d7', 'rls-bud-d@test.invalid');

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create temp table toks (k text primary key, v text) on commit drop;
grant all on toks to authenticated;

-- Executa um comando e devolve 'ok' ou 'sqlstate:hint' (o efeito do comando com erro é desfeito).
create function pg_temp.err(q text) returns text
language plpgsql
as $$
declare s text; h text;
begin
  execute q;
  return 'ok';
exception when others then
  get stacked diagnostics s = returned_sqlstate, h = pg_exception_hint;
  return s || ':' || coalesce(h, '');
end;
$$;

set local role authenticated;

------------------------------------------------------------
-- B cria uma categoria própria e uma meta (usadas nos testes de A)
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
do $$
declare cat uuid; g uuid;
begin
  insert into public.categories (kind, name, icon, color) values ('expense', 'Do B', 'tag', '#123456') returning id into cat;
  insert into ids values ('cat_b', cat);
  insert into public.goals (name, target_amount, currency) values ('Meta B', 100000, 'BRL') returning id into g;
  insert into ids values ('goal_b', g);
end $$;

------------------------------------------------------------
-- 1. Orçamentos pessoais de A
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
do $$
declare
  housing uuid; salary uuid; own uuid; b public.budgets; e text;
begin
  select id into housing from public.categories where i18n_key = 'housing';
  select id into salary from public.categories where i18n_key = 'salary';
  insert into public.categories (kind, name, icon, color) values ('expense', 'Do A', 'tag', '#654321') returning id into own;
  insert into ids values ('cat_a', own);

  insert into public.budgets (category_id, amount, currency) values (housing, 100000, 'BRL') returning * into b;
  insert into ids values ('bud_a', b.id);
  if b.user_id <> '00000000-0000-0000-0000-0000000000a7' or b.group_id is not null
     or b.created_by <> '00000000-0000-0000-0000-0000000000a7' or b.currency <> 'BRL' or b.amount <> 100000 then
    raise exception 'FAIL: orçamento pessoal % % % %', b.user_id, b.group_id, b.created_by, b.currency;
  end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency) values (%L, 5000, %L)', housing, 'BRL'));
  if e <> '23505:' then raise exception 'FAIL: orçamento duplicado (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency) values (%L, 5000, %L)', housing, 'EUR'));
  if e <> 'ok' then raise exception 'FAIL: mesma categoria em EUR (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency) values (%L, 5000, %L)', salary, 'BRL'));
  if e <> '23514:budget_category' then raise exception 'FAIL: categoria de receita (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency) values (%L, 5000, %L)',
                          (select v from ids where k = 'cat_b'), 'BRL'));
  if e <> '23514:budget_category' then raise exception 'FAIL: categoria própria de B (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency) values (%L, 5000, %L)', own, 'BRL'));
  if e <> 'ok' then raise exception 'FAIL: categoria própria de A (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency) values (%L, 0, %L)', own, 'USD'));
  if e not like '23514:%' then raise exception 'FAIL: valor zero (%)', e; end if;

  if (select count(*) from public.budgets) <> 3 then raise exception 'FAIL: A deveria ter 3 orçamentos'; end if;
end $$;

------------------------------------------------------------
-- 2. B não vê nem altera/exclui o orçamento pessoal de A
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
do $$
declare n int; bud uuid := (select v from ids where k = 'bud_a');
begin
  if (select count(*) from public.budgets) <> 0 then raise exception 'FAIL: B vê orçamentos de A'; end if;
  update public.budgets set amount = 1 where id = bud;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B alterou orçamento de A'; end if;
  delete from public.budgets where id = bud;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B excluiu orçamento de A'; end if;
end $$;

------------------------------------------------------------
-- 3. Orçamentos do grupo
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
do $$
declare g uuid; inv public.group_invites; groceries uuid; b public.budgets; e text;
begin
  g := public.create_group('Casa Orç', 'BRL', 'home');
  insert into ids values ('g', g);
  inv := public.create_group_invite(g);
  insert into toks values ('inv', inv.token);

  select id into groceries from public.categories where i18n_key = 'groceries';
  insert into public.budgets (category_id, amount, currency, group_id) values (groceries, 80000, 'EUR', g) returning * into b;
  insert into ids values ('bud_g', b.id);
  if b.currency <> 'BRL' or b.user_id is not null or b.group_id <> g
     or b.created_by <> '00000000-0000-0000-0000-0000000000a7' then
    raise exception 'FAIL: orçamento do grupo % % %', b.currency, b.user_id, b.created_by;
  end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency, group_id) values (%L, 5000, %L, %L)',
                          groceries, 'BRL', g));
  if e <> '23505:' then raise exception 'FAIL: orçamento do grupo duplicado (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency, group_id) values (%L, 5000, %L, %L)',
                          (select v from ids where k = 'cat_a'), 'BRL', g));
  if e <> '23514:budget_system_category' then raise exception 'FAIL: categoria própria no grupo (%)', e; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency, group_id) values (%L, 5000, %L, %L)',
                          (select id from public.categories where i18n_key = 'salary'), 'BRL', g));
  if e <> '23514:budget_category' then raise exception 'FAIL: receita no grupo (%)', e; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
do $$
declare g uuid := (select v from ids where k = 'g'); bud uuid := (select v from ids where k = 'bud_g'); n int; e text;
begin
  -- antes de entrar: não vê
  if exists (select 1 from public.budgets where id = bud) then raise exception 'FAIL: B vê antes de entrar'; end if;
  perform public.join_group((select v from toks where k = 'inv'));
  if (select count(*) from public.budgets where id = bud) <> 1 then raise exception 'FAIL: membro B não vê orçamento do grupo'; end if;

  e := pg_temp.err(format('insert into public.budgets (category_id, amount, currency, group_id) values (%L, 5000, %L, %L)',
                          (select id from public.categories where i18n_key = 'transport'), 'BRL', g));
  if e not like '42501:%' then raise exception 'FAIL: membro B criou orçamento do grupo (%)', e; end if;

  update public.budgets set amount = 1 where id = bud;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: membro B alterou orçamento do grupo'; end if;
  delete from public.budgets where id = bud;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: membro B excluiu orçamento do grupo'; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.budgets) <> 0 then raise exception 'FAIL: não membro C vê orçamentos'; end if;
end $$;

------------------------------------------------------------
-- 4. A altera só o valor; outras colunas são bloqueadas
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
do $$
declare bud uuid := (select v from ids where k = 'bud_a'); bud_g uuid := (select v from ids where k = 'bud_g'); e text;
begin
  update public.budgets set amount = 120000 where id = bud;
  if (select amount from public.budgets where id = bud) <> 120000 then raise exception 'FAIL: alterar valor pessoal'; end if;
  update public.budgets set amount = 90000 where id = bud_g;
  if (select amount from public.budgets where id = bud_g) <> 90000 then raise exception 'FAIL: alterar valor do grupo'; end if;

  e := pg_temp.err(format('update public.budgets set category_id = %L where id = %L',
                          (select id from public.categories where i18n_key = 'food'), bud));
  if e not like '42501:%' then raise exception 'FAIL: alterou category_id (%)', e; end if;
  e := pg_temp.err(format('update public.budgets set currency = %L where id = %L', 'USD', bud));
  if e not like '42501:%' then raise exception 'FAIL: alterou currency (%)', e; end if;
  e := pg_temp.err(format('update public.budgets set group_id = null where id = %L', bud_g));
  if e not like '42501:%' then raise exception 'FAIL: alterou group_id (%)', e; end if;
  e := pg_temp.err(format('update public.budgets set user_id = %L where id = %L', '00000000-0000-0000-0000-0000000000b7', bud));
  if e not like '42501:%' then raise exception 'FAIL: alterou user_id (%)', e; end if;
end $$;

------------------------------------------------------------
-- 5. Metas e aportes
------------------------------------------------------------
do $$
declare
  goal uuid; c_in uuid; c_out uuid; p public.goal_progress; e text; n int;
begin
  insert into public.goals (name, target_amount, currency, deadline)
    values ('Viagem', 500000, 'BRL', '2027-06-30') returning id into goal;
  insert into ids values ('goal_a', goal);
  if (select user_id from public.goals where id = goal) <> '00000000-0000-0000-0000-0000000000a7' then
    raise exception 'FAIL: dono da meta';
  end if;

  insert into public.goal_contributions (goal_id, amount, date) values (goal, 100000, '2026-03-01') returning id into c_in;
  select * into p from public.goal_progress where id = goal;
  if p.saved <> 100000 or p.contributions <> 1 or p.last_contribution <> '2026-03-01' or p.target_amount <> 500000 then
    raise exception 'FAIL: progresso após aporte % %', p.saved, p.contributions;
  end if;

  insert into public.goal_contributions (goal_id, amount, date, note) values (goal, -50000, '2026-04-01', 'retirada')
    returning id into c_out;
  select * into p from public.goal_progress where id = goal;
  if p.saved <> 50000 or p.contributions <> 2 or p.last_contribution <> '2026-04-01' then
    raise exception 'FAIL: progresso após retirada % %', p.saved, p.contributions;
  end if;

  e := pg_temp.err(format('insert into public.goal_contributions (goal_id, amount) values (%L, -60000)', goal));
  if e <> '23514:goal_negative' then raise exception 'FAIL: retirada maior que o guardado (%)', e; end if;

  e := pg_temp.err(format('delete from public.goal_contributions where id = %L', c_in));
  if e <> '23514:goal_negative' then raise exception 'FAIL: excluir aporte deixaria negativo (%)', e; end if;

  delete from public.goal_contributions where id = c_out;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: excluir a retirada'; end if;
  if (select saved from public.goal_progress where id = goal) <> 100000 then raise exception 'FAIL: guardado após excluir retirada'; end if;

  e := pg_temp.err(format('insert into public.goal_contributions (goal_id, amount) values (%L, 1000)',
                          (select v from ids where k = 'goal_b')));
  if e = 'ok' then raise exception 'FAIL: A aportou na meta de B'; end if;

  e := pg_temp.err(format('insert into public.goal_contributions (goal_id, amount) values (%L, 0)', goal));
  if e not like '23514:%' then raise exception 'FAIL: aporte zero (%)', e; end if;

  -- meta com aporte e retirada: excluir a meta leva os aportes junto, sem erro
  insert into public.goal_contributions (goal_id, amount) values (goal, -30000);
  update public.goals set name = 'Viagem 2', archived = true where id = goal;
  if (select count(*) from public.goal_progress where id = goal and archived and name = 'Viagem 2' and saved = 70000) <> 1 then
    raise exception 'FAIL: alterar meta';
  end if;
end $$;

-- B não vê metas nem aportes de A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
do $$
declare goal uuid := (select v from ids where k = 'goal_a'); n int;
begin
  if exists (select 1 from public.goals where id = goal) then raise exception 'FAIL: B vê meta de A'; end if;
  if exists (select 1 from public.goal_progress where id = goal) then raise exception 'FAIL: B vê progresso de A'; end if;
  if exists (select 1 from public.goal_contributions where goal_id = goal) then raise exception 'FAIL: B vê aportes de A'; end if;
  delete from public.goals where id = goal;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B excluiu meta de A'; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
do $$
declare goal uuid := (select v from ids where k = 'goal_a'); e text;
begin
  e := pg_temp.err(format('delete from public.goals where id = %L', goal));
  if e <> 'ok' then raise exception 'FAIL: excluir meta (%)', e; end if;
  if exists (select 1 from public.goal_contributions where goal_id = goal) then raise exception 'FAIL: aportes ficaram após excluir meta'; end if;
end $$;

------------------------------------------------------------
-- 6. group_period_entries
------------------------------------------------------------
do $$
declare g uuid := (select v from ids where k = 'g'); acc uuid; card uuid; food uuid;
begin
  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency, initial_balance) values ('Banco A7', 'checking', 'BRL', 0) returning id into acc;
  insert into public.cards (name, limit_amount, closing_day, due_day, currency)
    values ('Cartão A7', 500000, 10, 17, 'BRL') returning id into card;
  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 1000, '2026-01-15', food, 'Jan', acc, g);
  insert into public.transactions (kind, amount, date, category_id, description, card_id, installments_count, group_id)
    values ('expense', 3000, '2026-01-05', food, 'Parcelado', card, 3, g);
  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 400, '2025-12-20', food, 'Dez', acc, g);
  insert into public.transactions (kind, amount, date, category_id, description, account_id)
    values ('expense', 999, '2026-02-01', food, 'Pessoal', acc);
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
do $$
declare g uuid := (select v from ids where k = 'g'); acc uuid; food uuid;
begin
  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency, initial_balance) values ('Banco B7', 'checking', 'BRL', 0) returning id into acc;
  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 2000, '2026-02-10', food, 'Fev B', acc, g);
  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 500, '2026-03-20', food, 'Mar B', acc, g);
end $$;

do $$
declare g uuid := (select v from ids where k = 'g'); r record;
begin
  -- B (membro) vê as entradas de A e B no intervalo jan–mar
  select count(*) as n, sum(amount) as total, count(distinct month) as months,
         count(*) filter (where is_card) as card_n,
         count(*) filter (where month <> date_trunc('month', date)::date) as bad_month,
         count(distinct user_id) as users
    into r from public.group_period_entries(g, '2026-01-20', '2026-03-02');
  if r.n <> 6 or r.total <> 6500 or r.months <> 3 or r.card_n <> 3 or r.bad_month <> 0 or r.users <> 2 then
    raise exception 'FAIL: período jan–mar n=% total=% meses=% cartão=% mês errado=% pessoas=%',
      r.n, r.total, r.months, r.card_n, r.bad_month, r.users;
  end if;
  if (select count(*) from public.group_period_entries(g, '2026-01-01', '2026-01-31') where month = '2026-01-01') <> 2 then
    raise exception 'FAIL: janeiro';
  end if;
  if (select string_agg(installment_number::text, ',' order by month) from public.group_period_entries(g, '2026-01-01', '2026-03-31')
      where is_card) <> '1,2,3' then
    raise exception 'FAIL: parcelas por mês';
  end if;
  -- 24 meses: ok (inclui dezembro); 25 meses: nada
  if (select count(*) from public.group_period_entries(g, '2024-04-01', '2026-03-31')) <> 7 then
    raise exception 'FAIL: intervalo de 24 meses';
  end if;
  if (select count(*) from public.group_period_entries(g, '2024-03-01', '2026-03-31')) <> 0 then
    raise exception 'FAIL: intervalo de 25 meses trouxe linhas';
  end if;
  if (select count(*) from public.group_period_entries(g, '2026-03-01', '2026-01-01')) <> 0 then
    raise exception 'FAIL: intervalo invertido trouxe linhas';
  end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.group_period_entries((select v from ids where k = 'g'), '2026-01-01', '2026-03-31')) <> 0 then
    raise exception 'FAIL: não membro C vê entradas do grupo';
  end if;
end $$;

------------------------------------------------------------
-- Excluir a pessoa (cascata) com aporte e retirada não falha
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}';
do $$
declare goal uuid;
begin
  insert into public.goals (name, target_amount, currency) values ('Meta D', 100000, 'EUR') returning id into goal;
  insert into public.goal_contributions (goal_id, amount) values (goal, 10000);
  insert into public.goal_contributions (goal_id, amount) values (goal, -4000);
  insert into public.goal_contributions (goal_id, amount) values (goal, 2000);
  insert into public.budgets (category_id, amount, currency)
    values ((select id from public.categories where i18n_key = 'food'), 1000, 'EUR');
end $$;

reset role;
do $$
declare e text;
begin
  e := pg_temp.err($q$delete from auth.users where id = '00000000-0000-0000-0000-0000000000d7'$q$);
  if e <> 'ok' then raise exception 'FAIL: excluir usuário com metas (%)', e; end if;
  if exists (select 1 from public.goal_contributions where user_id = '00000000-0000-0000-0000-0000000000d7')
     or exists (select 1 from public.budgets where user_id = '00000000-0000-0000-0000-0000000000d7') then
    raise exception 'FAIL: dados de D ficaram';
  end if;
end $$;

------------------------------------------------------------
-- 7. Avisos em realtime.messages (mesma técnica do 06_realtime.sql)
------------------------------------------------------------
create temp table rt (skip boolean not null) on commit drop;
grant select on rt to authenticated;
create temp table snap (k text primary key, n bigint not null) on commit drop;

create function pg_temp.cnt(p_topic text, p_table text, p_op text) returns bigint
language sql
as $$
  select count(*) from realtime.messages
  where topic = p_topic and event = 'changed' and private and extension = 'broadcast'
    and payload->>'table' = p_table and payload->>'op' = p_op
$$;
create function pg_temp.mark(p_topic text, p_table text, p_op text) returns void
language sql
as $$
  insert into snap values (p_topic || '|' || p_table || '|' || p_op, pg_temp.cnt(p_topic, p_table, p_op))
  on conflict (k) do update set n = excluded.n
$$;
create function pg_temp.delta(p_topic text, p_table text, p_op text) returns bigint
language sql
as $$
  select pg_temp.cnt(p_topic, p_table, p_op)
    - coalesce((select n from snap where k = p_topic || '|' || p_table || '|' || p_op), 0)
$$;

-- Sem partição de hoje em realtime.messages os envios falham em silêncio: detecta e pula só as checagens de envio.
do $$
declare g text := 'group:' || (select v from ids where k = 'g');
begin
  begin
    insert into realtime.messages (topic, extension, event, payload, private)
      values ('probe:bud-test', 'broadcast', 'probe', '{}'::jsonb, true);
    insert into rt values (false);
  exception when check_violation then
    raise notice 'SKIP: realtime.messages sem partição para hoje; checagens de envio puladas';
    insert into rt values (true);
  end;
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000a7', 'budgets', 'INSERT');
  perform pg_temp.mark(g, 'budgets', 'INSERT');
end $$;

-- A cria um orçamento pessoal
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
insert into public.budgets (category_id, amount, currency)
  values ((select id from public.categories where i18n_key = 'transport'), 30000, 'BRL');

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000a7', 'budgets', 'INSERT') <> 1 then
    raise exception 'FAIL: orçamento pessoal não avisou user:A';
  end if;
  if pg_temp.delta(g, 'budgets', 'INSERT') <> 0 then
    raise exception 'FAIL: orçamento pessoal avisou o grupo';
  end if;
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000a7', 'budgets', 'INSERT');
  perform pg_temp.mark(g, 'budgets', 'INSERT');
end $$;

-- A cria um orçamento do grupo
set local role authenticated;
insert into public.budgets (category_id, amount, currency, group_id)
  values ((select id from public.categories where i18n_key = 'utilities'), 20000, 'BRL', (select v from ids where k = 'g'));

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta(g, 'budgets', 'INSERT') <> 1 then
    raise exception 'FAIL: orçamento do grupo não avisou group:G';
  end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000a7', 'budgets', 'INSERT') <> 0
     or pg_temp.delta('user:00000000-0000-0000-0000-0000000000b7', 'budgets', 'INSERT') <> 0 then
    raise exception 'FAIL: orçamento do grupo avisou um tópico user:';
  end if;
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000a7', 'goal_contributions', 'INSERT');
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000a7', 'goals', 'INSERT');
end $$;

-- A cria uma meta e aporta
set local role authenticated;
do $$
declare goal uuid;
begin
  insert into public.goals (name, target_amount, currency) values ('Reserva', 1000000, 'BRL') returning id into goal;
  insert into public.goal_contributions (goal_id, amount) values (goal, 25000);
end $$;

reset role;
do $$
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000a7', 'goals', 'INSERT') <> 1 then
    raise exception 'FAIL: meta não avisou user:A';
  end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000a7', 'goal_contributions', 'INSERT') <> 1 then
    raise exception 'FAIL: aporte não avisou user:A';
  end if;
end $$;

------------------------------------------------------------
-- Funções internas não são chamáveis pelo cliente; anon não chama o período
------------------------------------------------------------
do $$
begin
  if has_function_privilege('authenticated', 'public.broadcast_budget_change()', 'execute')
     or has_function_privilege('authenticated', 'public.budgets_validate()', 'execute')
     or has_function_privilege('authenticated', 'public.goal_contributions_validate()', 'execute')
     or has_function_privilege('authenticated', 'public.goal_contributions_guard_delete()', 'execute') then
    raise exception 'FAIL: authenticated executa função interna';
  end if;
  if has_function_privilege('anon', 'public.group_period_entries(uuid, date, date)', 'execute') then
    raise exception 'FAIL: anon executa group_period_entries';
  end if;
  if has_table_privilege('anon', 'public.budgets', 'select') or has_table_privilege('anon', 'public.goals', 'select')
     or has_table_privilege('anon', 'public.goal_contributions', 'select') or has_table_privilege('anon', 'public.goal_progress', 'select') then
    raise exception 'FAIL: anon lê tabelas novas';
  end if;
end $$;

rollback;
select 'PASS' as result;
