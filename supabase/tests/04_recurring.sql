-- Contas recorrentes: próxima data, geração, cartão, pausa, arquivadas, RLS, cron. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a4', 'rls-rec-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b4', 'rls-rec-b@test.invalid');

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create temp table cnt (n bigint) on commit drop;
grant all on cnt to authenticated;

set local role authenticated;

-- Usuário A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
do $$
declare
  acc uuid; acc2 uuid; acc_arch uuid; card uuid; housing uuid; salary uuid;
  rec_m uuid; rec_w uuid; rec_c uuid; rec_p uuid; rec_x uuid;
  r record; failed boolean; h text;
begin
  -- recurring_next
  if public.recurring_next('2026-01-31', 'monthly', '2026-01-31') <> '2026-02-28' then raise exception 'FAIL: next mensal 31/01'; end if;
  if public.recurring_next('2026-02-28', 'monthly', '2026-01-31') <> '2026-03-31' then raise exception 'FAIL: next mensal 28/02'; end if;
  if public.recurring_next('2026-03-10', 'weekly', '2026-03-10') <> '2026-03-17' then raise exception 'FAIL: next semanal'; end if;
  if public.recurring_next('2024-02-29', 'yearly', '2024-02-29') <> '2025-02-28' then raise exception 'FAIL: next anual 29/02'; end if;
  if public.recurring_next('2025-02-28', 'yearly', '2024-02-29') <> '2026-02-28' then raise exception 'FAIL: next anual 2025'; end if;

  select id into housing from public.categories where i18n_key = 'housing';
  select id into salary from public.categories where i18n_key = 'salary';

  insert into public.accounts (name, type, currency, initial_balance) values ('Banco A', 'checking', 'BRL', 0) returning id into acc;
  insert into public.cards (name, limit_amount, closing_day, due_day, currency)
    values ('Cartão A', 500000, 10, 17, 'BRL') returning id into card;
  insert into ids values ('acc', acc), ('card', card);

  insert into public.recurring (kind, amount, category_id, description, account_id, frequency, start_date)
    values ('expense', 5000, housing, 'Aluguel', acc, 'monthly', '2026-01-31') returning id into rec_m;
  insert into ids values ('rec_m', rec_m);
  select * into r from public.recurring where id = rec_m;
  if r.next_date <> '2026-01-31' or r.currency <> 'BRL' then
    raise exception 'FAIL: recorrente criada next % moeda %', r.next_date, r.currency;
  end if;

  -- Semanal de receita com fim (3 ocorrências)
  insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date, end_date)
    values ('income', 100, salary, acc, 'weekly', '2026-03-02', '2026-03-16') returning id into rec_w;
  insert into ids values ('rec_w', rec_w);

  -- No cartão
  insert into public.recurring (kind, amount, category_id, description, card_id, frequency, start_date)
    values ('expense', 3000, housing, 'Streaming', card, 'monthly', '2026-03-05') returning id into rec_c;
  insert into ids values ('rec_c', rec_c);

  -- Pausada
  insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date)
    values ('expense', 700, housing, acc, 'monthly', '2026-03-01') returning id into rec_p;
  update public.recurring set paused = true where id = rec_p;
  insert into ids values ('rec_p', rec_p);

  -- Conta que será arquivada depois de ter recorrente ativa
  insert into public.accounts (name, type, currency) values ('Arquivável', 'checking', 'BRL') returning id into acc_arch;
  insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date)
    values ('expense', 900, housing, acc_arch, 'monthly', '2026-03-01') returning id into rec_x;
  insert into ids values ('acc_arch', acc_arch), ('rec_x', rec_x);
  update public.accounts set archived = true where id = acc_arch;

  -- Nova recorrente em conta arquivada
  failed := false;
  begin
    insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date)
      values ('expense', 1, housing, acc_arch, 'monthly', '2026-03-01');
  exception when check_violation then
    get stacked diagnostics h = pg_exception_hint;
    failed := h = 'archived_source';
  end;
  if not failed then raise exception 'FAIL: recorrente em conta arquivada aceita'; end if;

  -- Receita no cartão
  failed := false;
  begin
    insert into public.recurring (kind, amount, category_id, card_id, frequency, start_date)
      values ('income', 1, salary, card, 'monthly', '2026-03-01');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: receita recorrente no cartão aceita'; end if;

  -- Categoria de tipo diferente
  failed := false;
  begin
    insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date)
      values ('expense', 1, salary, acc, 'monthly', '2026-03-01');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: categoria de tipo diferente aceita'; end if;

  -- Colunas protegidas
  failed := false;
  begin
    update public.recurring set next_date = '2030-01-01' where id = rec_m;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: cliente alterou next_date'; end if;

  failed := false;
  begin
    update public.recurring set currency = 'EUR' where id = rec_m;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: cliente alterou currency'; end if;

  failed := false;
  begin
    insert into public.transactions (kind, amount, date, category_id, account_id, recurring_id)
      values ('expense', 1, '2026-03-05', housing, acc, rec_m);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: cliente gravou transactions.recurring_id'; end if;
end $$;

-- Geração (somente o sistema)
reset role;
do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000a4';
  rec_m uuid; rec_w uuid; rec_c uuid; rec_p uuid; rec_x uuid; card uuid;
  n int; dates date[]; r record;
begin
  select v into rec_m from ids where k = 'rec_m';
  select v into rec_w from ids where k = 'rec_w';
  select v into rec_c from ids where k = 'rec_c';
  select v into rec_p from ids where k = 'rec_p';
  select v into rec_x from ids where k = 'rec_x';
  select v into card from ids where k = 'card';

  -- Até 15/04: mensal (3) + semanal (3) + cartão (05/03 e 05/04 = 2) = 8
  n := public.generate_recurring_for(a, '2026-04-15');
  if n <> 8 then raise exception 'FAIL: geração criou % (esperado 8)', n; end if;

  select array_agg(date order by date) into dates from public.transactions where recurring_id = rec_m;
  if dates is distinct from array['2026-01-31', '2026-02-28', '2026-03-31']::date[] then
    raise exception 'FAIL: datas da mensal %', dates;
  end if;
  select next_date into r from public.recurring where id = rec_m;
  if r.next_date <> '2026-04-30' then raise exception 'FAIL: next_date mensal %', r.next_date; end if;

  if public.generate_recurring_for(a, '2026-04-15') <> 0 then raise exception 'FAIL: segunda geração duplicou'; end if;
  select count(*) into n from public.transactions where recurring_id = rec_m;
  if n <> 3 then raise exception 'FAIL: duplicou lançamentos (%)', n; end if;

  -- Semanal com fim: exatamente 3 até o fim do ano
  perform public.generate_recurring_for(a, '2026-12-31');
  select count(*) into n from public.transactions where recurring_id = rec_w;
  if n <> 3 then raise exception 'FAIL: semanal com fim gerou % (esperado 3)', n; end if;

  -- Cartão: compra com 1 parcela e a fatura correspondente
  select count(*) into n from public.transactions where recurring_id = rec_c and installments_count = 1 and card_id = card;
  if n < 2 then raise exception 'FAIL: compras do cartão recorrente (%)', n; end if;
  select count(*) into n from public.installments i join public.transactions t on t.id = i.transaction_id
    where t.recurring_id = rec_c and i.number = 1 and i.invoice_id is not null;
  if n <> (select count(*) from public.transactions where recurring_id = rec_c) then
    raise exception 'FAIL: parcela/fatura do cartão recorrente';
  end if;
  if not exists (select 1 from public.invoices where card_id = card and reference_month = '2026-03-01') then
    raise exception 'FAIL: fatura de março do cartão não criada';
  end if;

  -- Pausada não gera
  select count(*) into n from public.transactions where recurring_id = rec_p;
  if n <> 0 then raise exception 'FAIL: pausada gerou %', n; end if;

  -- Origem arquivada: pausa e não cria
  select count(*) into n from public.transactions where recurring_id = rec_x;
  if n <> 0 then raise exception 'FAIL: recorrente de conta arquivada gerou %', n; end if;
  if not (select paused from public.recurring where id = rec_x) then
    raise exception 'FAIL: recorrente de conta arquivada não foi pausada';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
do $$
declare
  rec_m uuid; rec_d uuid; acc uuid; housing uuid; n int; n2 int;
begin
  select v into rec_m from ids where k = 'rec_m';
  select v into acc from ids where k = 'acc';
  select id into housing from public.categories where i18n_key = 'housing';

  -- month_entries expõe recurring_id (mensal gerada até 31/12: 12 ocorrências)
  select count(*) into n from public.month_entries where recurring_id = rec_m;
  if n <> 12 then raise exception 'FAIL: month_entries recurring_id (%)', n; end if;

  -- Excluir a recorrente mantém os lançamentos com recurring_id nulo
  delete from public.recurring where id = rec_m;
  select count(*) into n2 from public.transactions
    where recurring_id is null and description = 'Aluguel' and amount = 5000;
  if n2 <> 12 then raise exception 'FAIL: lançamentos após excluir recorrente (%)', n2; end if;

  -- Recorrente anual para a exclusão do usuário
  insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date)
    values ('expense', 1200, housing, acc, 'yearly', '2025-06-15') returning id into rec_d;
  insert into ids values ('rec_d', rec_d);
end $$;

-- Contagem de lançamentos de A, para conferir que B não gera nada
reset role;
insert into cnt select count(*) from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a4';

-- Usuário B
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}';
do $$
declare
  acc_a uuid; housing uuid; n int; failed boolean; created int;
begin
  select v into acc_a from ids where k = 'acc';
  select id into housing from public.categories where i18n_key = 'housing';

  select count(*) into n from public.recurring;
  if n <> 0 then raise exception 'FAIL: B vê recorrentes de A'; end if;

  created := public.generate_my_recurring();
  if created <> 0 then raise exception 'FAIL: B gerou % lançamentos', created; end if;

  failed := false;
  begin
    insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date)
      values ('expense', 1, housing, acc_a, 'monthly', '2026-03-01');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: B criou recorrente na conta de A'; end if;
end $$;

reset role;
do $$
declare n bigint; c bigint;
begin
  select cnt.n into c from cnt;
  select count(*) into n from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a4';
  if n <> c then raise exception 'FAIL: lançamentos de A mudaram após chamada de B (% -> %)', c, n; end if;

  -- Job do cron
  if not exists (select 1 from cron.job where jobname = 'finance-recorrentes-diarias') then
    raise exception 'FAIL: job de cron ausente';
  end if;

  -- Exclusão do usuário A em cascata
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000a4';
  set constraints all immediate;
  select count(*) into n from public.recurring where user_id = '00000000-0000-0000-0000-0000000000a4';
  if n <> 0 then raise exception 'FAIL: recorrentes de A restaram após excluir o usuário'; end if;
  select count(*) into n from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a4';
  if n <> 0 then raise exception 'FAIL: lançamentos de A restaram após excluir o usuário'; end if;
end $$;

set local role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform 1 from public.recurring;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê recorrentes'; end if;

  failed := false;
  begin
    perform public.generate_my_recurring();
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon executa generate_my_recurring'; end if;
end $$;

rollback;
select 'PASS' as result;
