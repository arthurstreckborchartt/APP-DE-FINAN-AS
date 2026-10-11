-- Cartões, faturas, parcelas, competência e pagamento de fatura. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'rls-card-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b3', 'rls-card-b@test.invalid');

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;

set local role authenticated;

-- Usuário A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
do $$
declare
  acc uuid; acc_eur uuid; card uuid; card2 uuid; sys_food uuid; sys_salary uuid;
  tx1 uuid; tx2 uuid; tx3 uuid; tx4 uuid; inv_mar uuid;
  n int; total bigint; amts bigint[]; refs date[]; r record; failed boolean; h text;
begin
  select id into sys_food from public.categories where i18n_key = 'food';
  select id into sys_salary from public.categories where i18n_key = 'salary';

  insert into public.accounts (name, type, currency, initial_balance)
    values ('Banco A', 'checking', 'BRL', 100000) returning id into acc;
  insert into public.cards (name, limit_amount, closing_day, due_day, currency)
    values ('Cartão A', 500000, 10, 17, 'BRL') returning id into card;
  insert into ids values ('acc', acc), ('card', card);

  -- Compra 1: 30000 em 3x no dia 05/03 (antes do fechamento)
  insert into public.transactions (kind, amount, date, category_id, card_id, installments_count)
    values ('expense', 30000, '2026-03-05', sys_food, card, 3) returning id into tx1;
  insert into ids values ('tx1', tx1);

  select array_agg(i.amount order by i.number), array_agg(v.reference_month order by i.number)
    into amts, refs
    from public.installments i join public.invoices v on v.id = i.invoice_id
    where i.transaction_id = tx1;
  if amts is distinct from array[10000, 10000, 10000]::bigint[] then
    raise exception 'FAIL: parcelas da compra 1 %', amts;
  end if;
  if refs is distinct from array['2026-03-01', '2026-04-01', '2026-05-01']::date[] then
    raise exception 'FAIL: faturas da compra 1 %', refs;
  end if;

  select * into r from public.invoices where card_id = card and reference_month = '2026-03-01';
  if r.closing_date <> '2026-03-10' or r.due_date <> '2026-03-17' then
    raise exception 'FAIL: datas da fatura de março % %', r.closing_date, r.due_date;
  end if;
  inv_mar := r.id;
  insert into ids values ('inv_mar', inv_mar);

  -- Compra 2: 1000 à vista no dia do fechamento → fatura seguinte
  insert into public.transactions (kind, amount, date, category_id, card_id)
    values ('expense', 1000, '2026-03-10', sys_food, card) returning id into tx2;
  select array_agg(v.reference_month) into refs
    from public.installments i join public.invoices v on v.id = i.invoice_id
    where i.transaction_id = tx2;
  if refs is distinct from array['2026-04-01']::date[] then
    raise exception 'FAIL: compra no dia do fechamento na fatura %', refs;
  end if;

  -- Compra 3: 1001 em 2x → 501 + 500
  insert into public.transactions (kind, amount, date, category_id, card_id, installments_count)
    values ('expense', 1001, '2026-03-01', sys_food, card, 2) returning id into tx3;
  select array_agg(amount order by number) into amts from public.installments where transaction_id = tx3;
  if amts is distinct from array[501, 500]::bigint[] then
    raise exception 'FAIL: parcelas da compra 3 %', amts;
  end if;

  -- Limite
  select * into r from public.card_limits where card_id = card;
  if r.used <> 32001 or r.available <> 467999 then
    raise exception 'FAIL: limite usado % disponível %', r.used, r.available;
  end if;

  -- Competência
  select sum(amount) into total from public.month_entries
    where user_id = '00000000-0000-0000-0000-0000000000a3' and month = '2026-04-01';
  if total is distinct from 10500 then raise exception 'FAIL: competência de abril % <> 10500', total; end if;
  select array_agg(month) into refs from public.month_entries where transaction_id = tx2;
  if refs is distinct from array['2026-03-01']::date[] then
    raise exception 'FAIL: competência da compra 2 %', refs;
  end if;

  -- Receita no cartão
  failed := false;
  begin
    insert into public.transactions (kind, amount, date, category_id, card_id)
      values ('income', 100, '2026-03-05', sys_salary, card);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: receita no cartão aceita'; end if;

  -- Cartão com vencimento <= fechamento
  insert into public.cards (name, limit_amount, closing_day, due_day, currency)
    values ('Cartão A2', 100000, 25, 5, 'BRL') returning id into card2;
  insert into public.transactions (kind, amount, date, category_id, card_id)
    values ('expense', 2000, '2026-03-26', sys_food, card2) returning id into tx4;
  select v2.* into r from public.installments i join public.invoices v2 on v2.id = i.invoice_id
    where i.transaction_id = tx4;
  if r.reference_month <> '2026-04-01' or r.closing_date <> '2026-04-25' or r.due_date <> '2026-05-05' then
    raise exception 'FAIL: fatura do cartão 2 % % %', r.reference_month, r.closing_date, r.due_date;
  end if;

  -- Pagar a fatura de março do cartão 1
  perform public.pay_invoice(inv_mar, acc);
  select * into r from public.invoices where id = inv_mar;
  if r.paid_at is null or r.payment_account_id <> acc or r.payment_amount <> 10501 then
    raise exception 'FAIL: pagamento da fatura % % %', r.paid_at, r.payment_account_id, r.payment_amount;
  end if;
  select available into total from public.card_limits where card_id = card;
  if total <> 478500 then raise exception 'FAIL: limite após pagamento % <> 478500', total; end if;
  select balance into total from public.account_balances where account_id = acc;
  if total <> 89499 then raise exception 'FAIL: saldo após pagamento % <> 89499', total; end if;

  -- Lançamento em fatura paga não pode ser alterado nem excluído
  failed := false;
  begin
    update public.transactions set description = 'x' where id = tx1;
  exception when check_violation then
    get stacked diagnostics h = pg_exception_hint;
    failed := h = 'paid_invoice';
  end;
  if not failed then raise exception 'FAIL: lançamento em fatura paga alterado'; end if;

  failed := false;
  begin
    delete from public.transactions where id = tx1;
  exception when check_violation then
    get stacked diagnostics h = pg_exception_hint;
    failed := h = 'paid_invoice';
  end;
  if not failed then raise exception 'FAIL: lançamento em fatura paga excluído'; end if;

  -- Pagar de novo
  failed := false;
  begin
    perform public.pay_invoice(inv_mar, acc);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: fatura paga duas vezes'; end if;

  -- Desfazer pagamento
  perform public.reopen_invoice(inv_mar);
  select * into r from public.invoices where id = inv_mar;
  if r.paid_at is not null or r.payment_account_id is not null or r.payment_amount is not null then
    raise exception 'FAIL: fatura não reaberta';
  end if;
  select available into total from public.card_limits where card_id = card;
  if total <> 467999 then raise exception 'FAIL: limite após reabrir % <> 467999', total; end if;

  -- Conta EUR pagando fatura BRL
  insert into public.accounts (name, type, currency) values ('Conta EUR', 'checking', 'EUR') returning id into acc_eur;
  failed := false;
  begin
    perform public.pay_invoice(inv_mar, acc_eur);
  exception when check_violation then
    get stacked diagnostics h = pg_exception_hint;
    failed := h = 'currency_mismatch';
  end;
  if not failed then raise exception 'FAIL: conta EUR pagou fatura BRL'; end if;

  -- Colunas e tabelas protegidas
  failed := false;
  begin
    update public.cards set currency = 'EUR' where id = card;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: moeda do cartão alterável'; end if;

  failed := false;
  begin
    insert into public.invoices (user_id, card_id, reference_month, closing_date, due_date)
      values ('00000000-0000-0000-0000-0000000000a3', card, '2027-01-01', '2027-01-10', '2027-01-17');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: cliente inseriu fatura'; end if;

  -- Deixa a fatura de março paga para o teste de exclusão do usuário
  perform public.pay_invoice(inv_mar, acc);
end $$;

-- Usuário B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
do $$
declare
  card_a uuid; inv_a uuid; acc_b uuid; sys_food uuid; n int; failed boolean;
begin
  select v into card_a from ids where k = 'card';
  select v into inv_a from ids where k = 'inv_mar';

  select count(*) into n from public.cards;
  if n <> 0 then raise exception 'FAIL: B vê cartões de A'; end if;
  select count(*) into n from public.invoices;
  if n <> 0 then raise exception 'FAIL: B vê faturas de A'; end if;
  select count(*) into n from public.installments;
  if n <> 0 then raise exception 'FAIL: B vê parcelas de A'; end if;
  select count(*) into n from public.card_limits;
  if n <> 0 then raise exception 'FAIL: B vê limites de A'; end if;
  select count(*) into n from public.invoice_summaries;
  if n <> 0 then raise exception 'FAIL: B vê resumos de faturas de A'; end if;
  select count(*) into n from public.month_entries;
  if n <> 0 then raise exception 'FAIL: B vê competência de A'; end if;

  insert into public.accounts (name, type, currency) values ('Conta B', 'checking', 'BRL') returning id into acc_b;
  failed := false;
  begin
    perform public.pay_invoice(inv_a, acc_b);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: B pagou fatura de A'; end if;

  select id into sys_food from public.categories where i18n_key = 'food';
  failed := false;
  begin
    insert into public.transactions (kind, amount, date, category_id, card_id)
      values ('expense', 1, '2026-03-05', sys_food, card_a);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: B lançou no cartão de A'; end if;
end $$;

-- Exclusão do usuário A (com fatura paga): cartões, faturas e parcelas somem em cascata
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.invoices
    where user_id = '00000000-0000-0000-0000-0000000000a3' and paid_at is not null;
  if n <> 1 then raise exception 'FAIL: esperada 1 fatura paga antes da exclusão (%)', n; end if;

  delete from auth.users where id = '00000000-0000-0000-0000-0000000000a3';
  set constraints all immediate;
  select count(*) into n from public.cards where user_id = '00000000-0000-0000-0000-0000000000a3';
  if n <> 0 then raise exception 'FAIL: cartões de A restaram após excluir o usuário'; end if;
  select count(*) into n from public.invoices where user_id = '00000000-0000-0000-0000-0000000000a3';
  if n <> 0 then raise exception 'FAIL: faturas de A restaram após excluir o usuário'; end if;
  select count(*) into n from public.installments where user_id = '00000000-0000-0000-0000-0000000000a3';
  if n <> 0 then raise exception 'FAIL: parcelas de A restaram após excluir o usuário'; end if;
end $$;

set local role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform 1 from public.cards;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê cartões'; end if;

  failed := false;
  begin
    perform 1 from public.invoices;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê faturas'; end if;

  failed := false;
  begin
    perform 1 from public.installments;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê parcelas'; end if;

  failed := false;
  begin
    perform 1 from public.card_limits;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê limites'; end if;
end $$;

rollback;
select 'PASS' as result;
