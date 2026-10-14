-- Grupos, membros, convites e lançamentos do grupo. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a5', 'rls-grp-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b5', 'rls-grp-b@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c5', 'rls-grp-c@test.invalid');
update public.profiles set name = 'Ana' where id = '00000000-0000-0000-0000-0000000000a5';
update public.profiles set name = 'Bruno' where id = '00000000-0000-0000-0000-0000000000b5';

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
-- 1. A cria o grupo; 5. lançamentos de A no grupo
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
do $$
declare
  g uuid; acc uuid; acc_eur uuid; food uuid; tx_a uuid; inv public.group_invites; r record; e text;
begin
  g := public.create_group('  Casa  ', 'BRL', 'home');
  insert into ids values ('g', g);

  select * into r from public.my_groups() x where x.id = g;
  if r.id is null or r.role <> 'admin' or r.members <> 1 or r.name <> 'Casa' or r.currency <> 'BRL' or r.icon <> 'home' then
    raise exception 'FAIL: my_groups de A % % % %', r.role, r.members, r.name, r.icon;
  end if;
  if (select count(*) from public.groups) <> 1 then raise exception 'FAIL: A não vê o próprio grupo'; end if;

  e := pg_temp.err($q$select public.create_group('Ruim', 'XYZ', 'users')$q$);
  if e not like '23514:%' then raise exception 'FAIL: grupo com moeda inválida (%)', e; end if;

  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency, initial_balance) values ('Banco A', 'checking', 'BRL', 0) returning id into acc;
  insert into public.accounts (name, type, currency, initial_balance) values ('Euro A', 'checking', 'EUR', 0) returning id into acc_eur;
  insert into ids values ('acc_a', acc), ('acc_a_eur', acc_eur);

  -- 5. Conta BRL no grupo BRL: ok
  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 1000, '2026-03-20', food, 'Feira', acc, g) returning id into tx_a;
  insert into ids values ('tx_a', tx_a);

  -- 5. Conta EUR no grupo BRL: group_currency (inserir e trocar de origem)
  e := pg_temp.err(format(
    $q$insert into public.transactions (kind, amount, date, category_id, account_id, group_id)
       values ('expense', 1, '2026-03-20', %L, %L, %L)$q$, food, acc_eur, g));
  if e <> '23514:group_currency' then raise exception 'FAIL: lançamento EUR no grupo BRL (%)', e; end if;
  e := pg_temp.err(format($q$update public.transactions set account_id = %L where id = %L$q$, acc_eur, tx_a));
  if e <> '23514:group_currency' then raise exception 'FAIL: troca para conta EUR no grupo BRL (%)', e; end if;

  -- 3. Convite
  inv := public.create_group_invite(g);
  if inv.group_id <> g or char_length(inv.token) <> 64 or inv.expires_at < now() + interval '6 days' then
    raise exception 'FAIL: convite criado % %', inv.group_id, inv.expires_at;
  end if;
  insert into ids values ('inv', inv.id);
  insert into toks values ('inv', inv.token);
  if (select count(*) from public.group_invites) <> 1 then raise exception 'FAIL: admin não vê o convite'; end if;
end $$;

------------------------------------------------------------
-- 2. B (não membro) não vê nada nem consegue mexer
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
do $$
declare
  g uuid; n int; e text; acc uuid; card uuid; food uuid; cat uuid;
begin
  select v into g from ids where k = 'g';

  if (select count(*) from public.groups) <> 0 then raise exception 'FAIL: não membro vê grupo'; end if;
  if (select count(*) from public.group_members) <> 0 then raise exception 'FAIL: não membro vê membros'; end if;
  if (select count(*) from public.group_invites) <> 0 then raise exception 'FAIL: não membro vê convites'; end if;
  if (select count(*) from public.my_groups()) <> 0 then raise exception 'FAIL: my_groups de não membro'; end if;
  if (select count(*) from public.group_member_list(g)) <> 0 then raise exception 'FAIL: group_member_list de não membro'; end if;
  if (select count(*) from public.group_month_entries(g, '2026-03-01')) <> 0 then
    raise exception 'FAIL: group_month_entries de não membro';
  end if;

  e := pg_temp.err(format($q$select public.create_group_invite(%L)$q$, g));
  if e <> '42501:not_admin' then raise exception 'FAIL: não membro criou convite (%)', e; end if;
  e := pg_temp.err(format($q$select public.revoke_group_invite(%L)$q$, (select v from ids where k = 'inv')));
  if e <> '42501:not_admin' then raise exception 'FAIL: não membro revogou convite (%)', e; end if;
  e := pg_temp.err(format(
    $q$insert into public.group_members (group_id, user_id, role) values (%L, '00000000-0000-0000-0000-0000000000b5', 'admin')$q$, g));
  if e not like '42501:%' then raise exception 'FAIL: insert direto em group_members (%)', e; end if;
  e := pg_temp.err(format($q$update public.groups set currency = 'EUR' where id = %L$q$, g));
  if e not like '42501:%' then raise exception 'FAIL: update de currency do grupo (%)', e; end if;
  e := pg_temp.err(format($q$insert into public.groups (name, currency) values ('X', 'BRL')$q$));
  if e not like '42501:%' then raise exception 'FAIL: insert direto em groups (%)', e; end if;

  -- Contas e categoria de B (usadas adiante)
  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency, initial_balance) values ('Banco B', 'checking', 'BRL', 0) returning id into acc;
  insert into public.cards (name, limit_amount, closing_day, due_day, currency)
    values ('Cartão B', 500000, 10, 17, 'BRL') returning id into card;
  insert into public.categories (kind, name, icon, color) values ('expense', 'Mercado', 'cart', '#12ab34') returning id into cat;
  insert into ids values ('acc_b', acc), ('card_b', card), ('cat_b', cat);

  -- Não membro não lança no grupo
  e := pg_temp.err(format(
    $q$insert into public.transactions (kind, amount, date, category_id, account_id, group_id)
       values ('expense', 1, '2026-03-20', %L, %L, %L)$q$, food, acc, g));
  if e <> '23514:not_group_member' then raise exception 'FAIL: não membro lançou no grupo (%)', e; end if;
end $$;

------------------------------------------------------------
-- 3. B entra pelo convite; 4. continua sem ver o que é pessoal de A
------------------------------------------------------------
do $$
declare
  g uuid; tok text; r record; n int;
begin
  select v into g from ids where k = 'g';
  select v into tok from toks where k = 'inv';

  select * into r from public.group_invite_preview(tok);
  if r.group_id is distinct from g or r.status <> 'valid' or r.name <> 'Casa' or r.members <> 1 or r.currency <> 'BRL' then
    raise exception 'FAIL: preview antes de entrar % % %', r.status, r.name, r.members;
  end if;

  if public.join_group(tok) <> g then raise exception 'FAIL: join_group devolveu outro grupo'; end if;

  select * into r from public.group_invite_preview(tok);
  if r.status <> 'member' or r.members <> 2 then raise exception 'FAIL: preview depois de entrar % %', r.status, r.members; end if;

  select * into r from public.my_groups() x where x.id = g;
  if r.role <> 'member' or r.members <> 2 then raise exception 'FAIL: my_groups de B % %', r.role, r.members; end if;

  -- Entrar de novo não duplica
  if public.join_group(tok) <> g then raise exception 'FAIL: segundo join_group'; end if;
  select count(*) into n from public.group_member_list(g);
  if n <> 2 then raise exception 'FAIL: membros após segundo join (%)', n; end if;
  if not exists (select 1 from public.group_member_list(g) m
                 where m.user_id = '00000000-0000-0000-0000-0000000000a5' and m.name = 'Ana' and m.role = 'admin') then
    raise exception 'FAIL: group_member_list sem A admin';
  end if;
  if (select count(*) from public.groups) <> 1 then raise exception 'FAIL: membro não vê o grupo'; end if;
  if (select count(*) from public.group_invites) <> 0 then raise exception 'FAIL: membro comum vê convites'; end if;

  -- 4. Nada pessoal de A
  if exists (select 1 from public.accounts where user_id <> '00000000-0000-0000-0000-0000000000b5') then
    raise exception 'FAIL: membro vê contas de outro';
  end if;
  if exists (select 1 from public.transactions where user_id <> '00000000-0000-0000-0000-0000000000b5') then
    raise exception 'FAIL: membro vê lançamentos de outro';
  end if;
  if exists (select 1 from public.month_entries where user_id <> '00000000-0000-0000-0000-0000000000b5') then
    raise exception 'FAIL: membro vê month_entries de outro';
  end if;
  select count(*) into n from public.accounts;
  if n <> 1 then raise exception 'FAIL: B vê % contas', n; end if;
end $$;

------------------------------------------------------------
-- 6. B compra no cartão em 3x para o grupo; recorrente de B no grupo
------------------------------------------------------------
do $$
declare
  g uuid; card uuid; cat uuid; tx_b uuid; rec_b uuid; acc uuid;
begin
  select v into g from ids where k = 'g';
  select v into card from ids where k = 'card_b';
  select v into cat from ids where k = 'cat_b';
  select v into acc from ids where k = 'acc_b';

  insert into public.transactions (kind, amount, date, category_id, description, card_id, installments_count, group_id)
    values ('expense', 30000, '2026-03-05', cat, 'Compra do mês', card, 3, g) returning id into tx_b;
  insert into ids values ('tx_b', tx_b);

  insert into public.recurring (kind, amount, category_id, description, account_id, frequency, start_date, group_id)
    values ('expense', 500, cat, 'Internet', acc, 'monthly', current_date + 400, g) returning id into rec_b;
  insert into ids values ('rec_b', rec_b);
end $$;

------------------------------------------------------------
-- C (não membro) não lança no grupo
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
do $$
declare
  g uuid; acc uuid; food uuid; e text;
begin
  select v into g from ids where k = 'g';
  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency) values ('Banco C', 'checking', 'BRL') returning id into acc;
  e := pg_temp.err(format(
    $q$insert into public.transactions (kind, amount, date, category_id, account_id, group_id)
       values ('expense', 1, '2026-03-20', %L, %L, %L)$q$, food, acc, g));
  if e <> '23514:not_group_member' then raise exception 'FAIL: C lançou no grupo (%)', e; end if;
  e := pg_temp.err(format(
    $q$insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date, group_id)
       values ('expense', 1, %L, %L, 'monthly', '2026-03-01', %L)$q$, food, acc, g));
  if e <> '23514:not_group_member' then raise exception 'FAIL: C criou recorrente no grupo (%)', e; end if;
end $$;

------------------------------------------------------------
-- 6. A vê a parcela de B no grupo; 7. recorrente do grupo
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
do $$
declare
  g uuid; tx_a uuid; tx_b uuid; cat uuid; acc uuid; food uuid; rec_a uuid; r record; n int; names text[];
begin
  select v into g from ids where k = 'g';
  select v into tx_a from ids where k = 'tx_a';
  select v into tx_b from ids where k = 'tx_b';
  select v into cat from ids where k = 'cat_b';
  select v into acc from ids where k = 'acc_a';

  select count(*) into n from public.group_month_entries(g, '2026-03-15');
  if n <> 2 then raise exception 'FAIL: group_month_entries de março (%)', n; end if;

  select * into r from public.group_month_entries(g, '2026-03-15') x where x.transaction_id = tx_b;
  if r.is_card is distinct from true or r.amount <> 10000 or r.installment_number <> 1 or r.installments_count <> 3
     or r.user_id <> '00000000-0000-0000-0000-0000000000b5' or r.currency <> 'BRL' or r.kind <> 'expense'
     or r.category_id <> cat or r.category_name <> 'Mercado' or r.category_icon <> 'cart' or r.category_color <> '#12ab34'
     or r.description <> 'Compra do mês' or r.date <> '2026-03-05' then
    raise exception 'FAIL: parcela 1 vista por A % % % % %', r.is_card, r.amount, r.installment_number, r.category_name, r.date;
  end if;

  select * into r from public.group_month_entries(g, '2026-03-01') x where x.transaction_id = tx_a;
  if r.is_card is distinct from false or r.amount <> 1000 or r.category_key <> 'food' or r.category_name is not null then
    raise exception 'FAIL: lançamento de A no grupo % % %', r.is_card, r.amount, r.category_key;
  end if;

  select * into r from public.group_month_entries(g, '2026-04-01') x where x.transaction_id = tx_b;
  if r.installment_number is distinct from 2::smallint or r.amount <> 10000 or r.date <> '2026-04-05' then
    raise exception 'FAIL: parcela 2 em abril % %', r.installment_number, r.date;
  end if;
  if (select count(*) from public.group_month_entries(g, '2026-04-01')) <> 1 then
    raise exception 'FAIL: abril deveria ter só a parcela 2';
  end if;

  -- Colunas sem conta/cartão
  select proargnames into names from pg_catalog.pg_proc
    where oid = 'public.group_month_entries(uuid, date)'::regprocedure;
  if 'account_id' = any(names) or 'card_id' = any(names) or 'invoice_id' = any(names) then
    raise exception 'FAIL: group_month_entries expõe conta/cartão %', names;
  end if;

  -- 7. Recorrente do grupo gerada pelo próprio usuário
  select id into food from public.categories where i18n_key = 'food';
  insert into public.recurring (kind, amount, category_id, description, account_id, frequency, start_date, group_id)
    values ('expense', 2500, food, 'Diarista', acc, 'monthly', current_date - 3, g) returning id into rec_a;
  insert into ids values ('rec_a', rec_a);
  n := public.generate_my_recurring();
  if n < 1 then raise exception 'FAIL: recorrente do grupo não gerou (%)', n; end if;
  select count(*) into n from public.transactions where recurring_id = rec_a and group_id = g;
  if n <> 1 then raise exception 'FAIL: lançamento gerado sem grupo (%)', n; end if;
  if (select count(*) from public.transactions where recurring_id = rec_a and group_id is null) <> 0 then
    raise exception 'FAIL: lançamento gerado fora do grupo';
  end if;
end $$;

------------------------------------------------------------
-- 8. B sai do grupo
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
do $$
declare
  g uuid; tx_b uuid; rec_b uuid; acc uuid; cat uuid; e text; n int;
begin
  select v into g from ids where k = 'g';
  select v into tx_b from ids where k = 'tx_b';
  select v into rec_b from ids where k = 'rec_b';
  select v into acc from ids where k = 'acc_b';
  select v into cat from ids where k = 'cat_b';

  perform public.leave_group(g);

  if (select group_id from public.recurring where id = rec_b) is not null then
    raise exception 'FAIL: recorrente de quem saiu continua no grupo';
  end if;
  if (select group_id from public.transactions where id = tx_b) is distinct from g then
    raise exception 'FAIL: lançamento antigo saiu do grupo';
  end if;
  if (select count(*) from public.group_month_entries(g, '2026-03-01')) <> 0 then
    raise exception 'FAIL: ex-membro ainda vê group_month_entries';
  end if;
  if (select count(*) from public.my_groups()) <> 0 then raise exception 'FAIL: my_groups de ex-membro'; end if;
  if (select count(*) from public.groups) <> 0 then raise exception 'FAIL: ex-membro vê o grupo'; end if;

  -- Pode editar o lançamento antigo (sem trocar de grupo)
  update public.transactions set description = 'Compra do mês (editada)' where id = tx_b;
  if not found then raise exception 'FAIL: ex-membro não editou lançamento antigo'; end if;

  -- Não lança nem marca novo no grupo
  e := pg_temp.err(format(
    $q$insert into public.transactions (kind, amount, date, category_id, account_id, group_id)
       values ('expense', 1, '2026-03-20', %L, %L, %L)$q$, cat, acc, g));
  if e <> '23514:not_group_member' then raise exception 'FAIL: ex-membro lançou no grupo (%)', e; end if;
  e := pg_temp.err(format($q$update public.recurring set group_id = %L where id = %L$q$, g, rec_b));
  if e <> '23514:not_group_member' then raise exception 'FAIL: ex-membro marcou recorrente no grupo (%)', e; end if;

  e := pg_temp.err(format($q$select public.leave_group(%L)$q$, g));
  if e <> '23514:not_member' then raise exception 'FAIL: sair de novo (%)', e; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
do $$
declare
  g uuid; tx_b uuid; r record;
begin
  select v into g from ids where k = 'g';
  select v into tx_b from ids where k = 'tx_b';
  select * into r from public.group_month_entries(g, '2026-03-01') x where x.transaction_id = tx_b;
  if r.entry_id is null or r.description <> 'Compra do mês (editada)' then
    raise exception 'FAIL: lançamento de quem saiu sumiu do grupo';
  end if;
  select * into r from public.my_groups() x where x.id = g;
  if r.members <> 1 then raise exception 'FAIL: membros após B sair (%)', r.members; end if;
  if not exists (select 1 from public.group_member_list(g) m
                 where m.user_id = '00000000-0000-0000-0000-0000000000b5' and m.left_at is not null) then
    raise exception 'FAIL: histórico de membros sem B';
  end if;
end $$;

------------------------------------------------------------
-- 9. Admin não sai; B volta; remoção e transferência
------------------------------------------------------------
do $$
declare
  g uuid; e text;
begin
  select v into g from ids where k = 'g';
  e := pg_temp.err(format($q$select public.leave_group(%L)$q$, g));
  if e <> '23514:admin_must_transfer' then raise exception 'FAIL: admin saiu (%)', e; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
do $$
declare
  g uuid; tok text; e text; r record;
begin
  select v into g from ids where k = 'g';
  select v into tok from toks where k = 'inv';

  if public.join_group(tok) <> g then raise exception 'FAIL: B não voltou'; end if;
  select * into r from public.group_member_list(g) m where m.user_id = '00000000-0000-0000-0000-0000000000b5';
  if r.left_at is not null or r.role <> 'member' then raise exception 'FAIL: B voltou com left_at % role %', r.left_at, r.role; end if;
  if (select count(*) from public.group_member_list(g)) <> 2 then raise exception 'FAIL: membros após voltar'; end if;

  e := pg_temp.err(format($q$select public.remove_member(%L, '00000000-0000-0000-0000-0000000000a5')$q$, g));
  if e <> '42501:not_admin' then raise exception 'FAIL: membro removeu admin (%)', e; end if;
  e := pg_temp.err(format($q$select public.transfer_admin(%L, '00000000-0000-0000-0000-0000000000b5')$q$, g));
  if e <> '42501:not_admin' then raise exception 'FAIL: membro transferiu admin (%)', e; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
do $$
declare
  g uuid; rec_a uuid; e text; n int;
begin
  select v into g from ids where k = 'g';
  select v into rec_a from ids where k = 'rec_a';

  e := pg_temp.err(format($q$select public.remove_member(%L, '00000000-0000-0000-0000-0000000000a5')$q$, g));
  if e <> '23514:cannot_remove_self' then raise exception 'FAIL: admin removeu a si mesmo (%)', e; end if;
  e := pg_temp.err(format($q$select public.remove_member(%L, '00000000-0000-0000-0000-0000000000c5')$q$, g));
  if e <> '23514:not_member' then raise exception 'FAIL: removeu quem não é membro (%)', e; end if;
  e := pg_temp.err(format($q$select public.transfer_admin(%L, '00000000-0000-0000-0000-0000000000c5')$q$, g));
  if e <> '23514:not_member' then raise exception 'FAIL: transferiu para não membro (%)', e; end if;

  perform public.transfer_admin(g, '00000000-0000-0000-0000-0000000000b5');
  if not exists (select 1 from public.group_member_list(g) m
                 where m.user_id = '00000000-0000-0000-0000-0000000000b5' and m.role = 'admin') then
    raise exception 'FAIL: B não virou admin';
  end if;
  if not exists (select 1 from public.group_member_list(g) m
                 where m.user_id = '00000000-0000-0000-0000-0000000000a5' and m.role = 'member') then
    raise exception 'FAIL: A não virou membro';
  end if;
  select count(*) into n from public.group_member_list(g) m where m.role = 'admin';
  if n <> 1 then raise exception 'FAIL: % admins', n; end if;
  if (select count(*) from public.group_invites) <> 0 then raise exception 'FAIL: ex-admin vê convites'; end if;

  -- Ex-admin edita nome? não
  update public.groups set name = 'Hack' where id = g;
  if found then raise exception 'FAIL: não admin renomeou o grupo'; end if;

  perform public.leave_group(g);
  if (select group_id from public.recurring where id = rec_a) is not null then
    raise exception 'FAIL: recorrente de A continua no grupo após sair';
  end if;
end $$;

------------------------------------------------------------
-- C entra (membro comum para o caso 12); 10. convites revogados/expirados
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
do $$
declare
  g uuid; tok text;
begin
  select v into g from ids where k = 'g';
  select v into tok from toks where k = 'inv';
  if public.join_group(tok) <> g then raise exception 'FAIL: C não entrou'; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
do $$
declare
  g uuid; inv2 public.group_invites;
begin
  select v into g from ids where k = 'g';
  -- Admin renomeia
  update public.groups set name = 'Casa nova', icon = 'house' where id = g;
  if not found then raise exception 'FAIL: admin não renomeou o grupo'; end if;
  if (select count(*) from public.group_invites) <> 1 then raise exception 'FAIL: novo admin não vê convites'; end if;

  perform public.revoke_group_invite((select v from ids where k = 'inv'));
  if (select revoked_at from public.group_invites where id = (select v from ids where k = 'inv')) is null then
    raise exception 'FAIL: convite não revogado';
  end if;
  inv2 := public.create_group_invite(g);
  insert into ids values ('inv2', inv2.id);
  insert into toks values ('inv2', inv2.token);
end $$;

reset role;
update public.group_invites set expires_at = now() - interval '1 minute' where id = (select v from ids where k = 'inv2');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
do $$
declare
  tok text; tok2 text; e text; r record;
begin
  select v into tok from toks where k = 'inv';
  select v into tok2 from toks where k = 'inv2';

  select * into r from public.group_invite_preview(tok);
  if r.status is distinct from 'expired' or r.name <> 'Casa nova' then raise exception 'FAIL: preview do revogado %', r.status; end if;
  e := pg_temp.err(format($q$select public.join_group(%L)$q$, tok));
  if e <> '23514:invite_expired' then raise exception 'FAIL: entrou com convite revogado (%)', e; end if;

  select * into r from public.group_invite_preview(tok2);
  if r.status is distinct from 'expired' then raise exception 'FAIL: preview do expirado %', r.status; end if;
  e := pg_temp.err(format($q$select public.join_group(%L)$q$, tok2));
  if e <> '23514:invite_expired' then raise exception 'FAIL: entrou com convite expirado (%)', e; end if;

  e := pg_temp.err($q$select public.join_group('nao-existe')$q$);
  if e <> '23514:invite_invalid' then raise exception 'FAIL: convite inexistente (%)', e; end if;
  if (select count(*) from public.group_invite_preview('nao-existe')) <> 0 then
    raise exception 'FAIL: preview de convite inexistente';
  end if;
end $$;

------------------------------------------------------------
-- 11. Fatura paga: marcar/desmarcar grupo não mexe nas parcelas
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
do $$
declare
  g uuid; tx_b uuid; acc uuid; inv uuid; ids0 uuid[]; invs0 uuid[]; ids1 uuid[]; invs1 uuid[]; e text;
begin
  select v into g from ids where k = 'g';
  select v into tx_b from ids where k = 'tx_b';
  select v into acc from ids where k = 'acc_b';

  select invoice_id into inv from public.installments where transaction_id = tx_b and number = 1;
  perform public.pay_invoice(inv, acc);

  select array_agg(id order by number), array_agg(invoice_id order by number) into ids0, invs0
    from public.installments where transaction_id = tx_b;

  update public.transactions set group_id = null where id = tx_b;
  if not found then raise exception 'FAIL: desmarcar grupo em fatura paga'; end if;
  update public.transactions set group_id = g where id = tx_b;
  if not found then raise exception 'FAIL: marcar grupo em fatura paga'; end if;

  select array_agg(id order by number), array_agg(invoice_id order by number) into ids1, invs1
    from public.installments where transaction_id = tx_b;
  if ids1 is distinct from ids0 or invs1 is distinct from invs0 then
    raise exception 'FAIL: parcelas regeneradas ao trocar grupo';
  end if;

  e := pg_temp.err(format($q$update public.transactions set amount = 30001 where id = %L$q$, tx_b));
  if e <> '23514:paid_invoice' then raise exception 'FAIL: alterou valor em fatura paga (%)', e; end if;

  -- Recorrente para conferir a exclusão do grupo
  with x as (
    insert into public.recurring (kind, amount, category_id, account_id, frequency, start_date, group_id)
      values ('expense', 700, (select v from ids where k = 'cat_b'), acc, 'monthly', current_date + 400, g)
      returning id)
  insert into ids select 'rec_b2', x.id from x;
end $$;

------------------------------------------------------------
-- 12. Exclusão do grupo
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
do $$
declare
  g uuid; n int;
begin
  select v into g from ids where k = 'g';
  delete from public.groups where id = g;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: não admin excluiu o grupo'; end if;
  if (select count(*) from public.groups where id = g) <> 1 then raise exception 'FAIL: grupo sumiu para C'; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
do $$
declare
  g uuid; n int;
begin
  select v into g from ids where k = 'g';
  delete from public.groups where id = g;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin não excluiu o grupo'; end if;
  if (select group_id from public.transactions where id = (select v from ids where k = 'tx_b')) is not null then
    raise exception 'FAIL: compra em fatura paga continua com grupo';
  end if;
  if (select group_id from public.recurring where id = (select v from ids where k = 'rec_b2')) is not null then
    raise exception 'FAIL: recorrente continua com grupo';
  end if;
end $$;

reset role;
do $$
declare
  g uuid; n int;
begin
  select v into g from ids where k = 'g';
  if exists (select 1 from public.transactions where group_id = g) or exists (select 1 from public.recurring where group_id = g) then
    raise exception 'FAIL: restaram lançamentos/recorrentes com o grupo excluído';
  end if;
  select count(*) into n from public.transactions
    where id in (select v from ids where k in ('tx_a', 'tx_b'));
  if n <> 2 then raise exception 'FAIL: lançamentos sumiram com o grupo (%)', n; end if;
  if (select amount from public.transactions where id = (select v from ids where k = 'tx_b')) <> 30000 then
    raise exception 'FAIL: valor mudou ao excluir o grupo';
  end if;
  if exists (select 1 from public.group_members where group_id = g) or exists (select 1 from public.group_invites where group_id = g) then
    raise exception 'FAIL: membros/convites restaram';
  end if;
end $$;

-- anon não chama nada de grupo
set local role anon;
do $$
declare e text;
begin
  e := pg_temp.err($q$select public.my_groups()$q$);
  if e not like '42501:%' then raise exception 'FAIL: anon executa my_groups (%)', e; end if;
  e := pg_temp.err($q$select * from public.group_invite_preview('x')$q$);
  if e not like '42501:%' then raise exception 'FAIL: anon executa group_invite_preview (%)', e; end if;
  e := pg_temp.err($q$select 1 from public.groups$q$);
  if e not like '42501:%' then raise exception 'FAIL: anon lê groups (%)', e; end if;
end $$;

rollback;
select 'PASS' as result;
