-- Tempo real por canais privados: quem pode ouvir cada tópico e gatilhos que não quebram escritas.
-- Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a6', 'rls-rt-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b6', 'rls-rt-b@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c6', 'rls-rt-c@test.invalid');

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create temp table toks (k text primary key, v text) on commit drop;
grant all on toks to authenticated;

-- Estrutura: policy em realtime.messages e tabelas fora da publicação
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'realtime' and tablename = 'messages' and policyname = 'finance_private_listen') then
    raise exception 'FAIL: policy finance_private_listen ausente';
  end if;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public'
               and tablename in ('transactions', 'invoices', 'cards', 'recurring')) then
    raise exception 'FAIL: tabelas pessoais ainda na publicação supabase_realtime';
  end if;
end $$;

set local role authenticated;

------------------------------------------------------------
-- A: tópico próprio, grupo, escritas em todas as tabelas
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
do $$
declare
  g uuid; acc uuid; acc2 uuid; card uuid; food uuid; tx uuid; tx_g uuid; tx_c uuid; rec uuid; inv public.group_invites;
begin
  if not public.realtime_can_listen('user:00000000-0000-0000-0000-0000000000a6') then
    raise exception 'FAIL: A não ouve o próprio tópico';
  end if;
  if public.realtime_can_listen('user:00000000-0000-0000-0000-0000000000b6') then
    raise exception 'FAIL: A ouve o tópico de B';
  end if;
  if public.realtime_can_listen('') then raise exception 'FAIL: tópico vazio'; end if;
  if public.realtime_can_listen('group:xyz') then raise exception 'FAIL: group:xyz'; end if;
  if public.realtime_can_listen('group:00000000-0000-0000-0000-00000000dead') then
    raise exception 'FAIL: grupo inexistente';
  end if;

  g := public.create_group('Casa RT', 'BRL', 'home');
  insert into ids values ('g', g);
  if not public.realtime_can_listen('group:' || g::text) then raise exception 'FAIL: admin não ouve o grupo'; end if;
  if public.realtime_can_listen('GROUP:' || g::text) or public.realtime_can_listen('group:' || upper(g::text)) then
    raise exception 'FAIL: tópico de grupo fora do formato aceito';
  end if;

  inv := public.create_group_invite(g);
  insert into toks values ('inv', inv.token);

  -- Escritas: conta, cartão, lançamento (sem e com grupo, no cartão), recorrente
  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency, initial_balance) values ('Banco RT', 'checking', 'BRL', 0) returning id into acc;
  insert into public.accounts (name, type, currency, initial_balance) values ('Extra RT', 'checking', 'BRL', 0) returning id into acc2;
  update public.accounts set name = 'Banco RT 2' where id = acc;
  insert into public.cards (name, limit_amount, closing_day, due_day, currency)
    values ('Cartão RT', 500000, 10, 17, 'BRL') returning id into card;
  update public.cards set name = 'Cartão RT 2' where id = card;

  insert into public.transactions (kind, amount, date, category_id, description, account_id)
    values ('expense', 1000, '2026-03-20', food, 'Pessoal', acc) returning id into tx;
  update public.transactions set amount = 1500 where id = tx;
  update public.transactions set group_id = g where id = tx;
  update public.transactions set group_id = null where id = tx;
  delete from public.transactions where id = tx;

  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 2000, '2026-03-21', food, 'Grupo', acc, g) returning id into tx_g;
  update public.transactions set description = 'Grupo 2' where id = tx_g;
  insert into ids values ('tx_g', tx_g);

  insert into public.transactions (kind, amount, date, category_id, card_id, installments_count)
    values ('expense', 3000, '2026-03-05', food, card, 3) returning id into tx_c;
  delete from public.transactions where id = tx_c;

  insert into public.recurring (kind, amount, category_id, description, account_id, frequency, start_date, group_id)
    values ('expense', 5000, food, 'Aluguel', acc, 'monthly', '2026-01-31', g) returning id into rec;
  update public.recurring set paused = true where id = rec;
  delete from public.recurring where id = rec;

  delete from public.accounts where id = acc2;
end $$;

------------------------------------------------------------
-- B entra no grupo, ouve; C não ouve
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}';
do $$
declare g uuid;
begin
  select v into g from ids where k = 'g';
  if public.realtime_can_listen('group:' || g::text) then raise exception 'FAIL: B ouve antes de entrar'; end if;
  perform public.join_group((select v from toks where k = 'inv'));
  if not public.realtime_can_listen('group:' || g::text) then raise exception 'FAIL: membro B não ouve o grupo'; end if;
  if public.realtime_can_listen('user:00000000-0000-0000-0000-0000000000a6') then
    raise exception 'FAIL: B ouve o tópico de A';
  end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}';
do $$
declare g uuid;
begin
  select v into g from ids where k = 'g';
  if public.realtime_can_listen('group:' || g::text) then raise exception 'FAIL: não membro C ouve o grupo'; end if;
  perform public.join_group((select v from toks where k = 'inv'));
end $$;

-- B sai: deixa de ouvir
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}';
do $$
declare g uuid;
begin
  select v into g from ids where k = 'g';
  perform public.leave_group(g);
  if public.realtime_can_listen('group:' || g::text) then raise exception 'FAIL: B ouve depois de sair'; end if;
  if not public.realtime_can_listen('user:00000000-0000-0000-0000-0000000000b6') then
    raise exception 'FAIL: B perdeu o próprio tópico';
  end if;
end $$;

-- A remove C, renomeia e exclui o grupo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
do $$
declare g uuid;
begin
  select v into g from ids where k = 'g';
  perform public.remove_member(g, '00000000-0000-0000-0000-0000000000c6');
  update public.groups set name = 'Casa RT 2' where id = g;
  delete from public.groups where id = g;
  if public.realtime_can_listen('group:' || g::text) then raise exception 'FAIL: ouve grupo excluído'; end if;
  if (select group_id from public.transactions where id = (select v from ids where k = 'tx_g')) is not null then
    raise exception 'FAIL: lançamento continua no grupo excluído';
  end if;
end $$;

-- Sem usuário
set local request.jwt.claims = '';
do $$
begin
  if public.realtime_can_listen('user:00000000-0000-0000-0000-0000000000a6') then
    raise exception 'FAIL: sem usuário ouve tópico';
  end if;
  if public.realtime_can_listen('user:') then raise exception 'FAIL: sem usuário ouve user:'; end if;
end $$;

-- Funções internas não são chamáveis pelo cliente
do $$
begin
  begin
    perform public.notify_topic('user:00000000-0000-0000-0000-0000000000a6', 'x', 'INSERT');
    raise exception 'FAIL: authenticated chama notify_topic';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform public.realtime_can_listen('user:00000000-0000-0000-0000-0000000000a6');
    raise exception 'FAIL: anon chama realtime_can_listen';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
select 'PASS' as result;
