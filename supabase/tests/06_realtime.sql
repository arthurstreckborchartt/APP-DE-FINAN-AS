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

------------------------------------------------------------
-- Avisos realmente gravados em realtime.messages (lidos como postgres)
-- e a policy finance_private_listen aplicada como authenticated.
-- Cada ação é medida pela diferença de contagem antes/depois.
------------------------------------------------------------
reset role;
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
begin
  begin
    insert into realtime.messages (topic, extension, event, payload, private)
      values ('probe:rt-test', 'broadcast', 'probe', '{}'::jsonb, true);
    insert into rt values (false);
  exception when check_violation then
    raise notice 'SKIP: realtime.messages sem partição para hoje; checagens de envio puladas';
    insert into rt values (true);
  end;
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000a6', 'accounts', 'INSERT');
end $$;

-- A cria o grupo G2 e uma conta
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
do $$
declare g uuid; inv public.group_invites;
begin
  g := public.create_group('Casa RT msg', 'BRL', 'home');
  insert into ids values ('g2', g);
  inv := public.create_group_invite(g);
  insert into toks values ('inv2', inv.token);
  insert into public.accounts (name, type, currency, initial_balance) values ('Msg RT', 'checking', 'BRL', 0);
end $$;

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000a6', 'accounts', 'INSERT') <> 1 then
    raise exception 'FAIL: inserir conta não avisou user:A';
  end if;
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000a6', 'transactions', 'INSERT');
  perform pg_temp.mark(g, 'transactions', 'INSERT');
end $$;

-- A lança no grupo G2
set local role authenticated;
do $$
declare acc uuid; food uuid; tx uuid;
begin
  select id into acc from public.accounts where name = 'Msg RT';
  select id into food from public.categories where i18n_key = 'food';
  insert into public.transactions (kind, amount, date, category_id, description, account_id, group_id)
    values ('expense', 700, '2026-03-22', food, 'Msg grupo', acc, (select v from ids where k = 'g2')) returning id into tx;
  insert into ids values ('tx_m', tx);
end $$;

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000a6', 'transactions', 'INSERT') <> 1 then
    raise exception 'FAIL: lançamento no grupo não avisou user:A';
  end if;
  if pg_temp.delta(g, 'transactions', 'INSERT') <> 1 then
    raise exception 'FAIL: lançamento no grupo não avisou group:G2';
  end if;
  perform pg_temp.mark(g, 'transactions', 'UPDATE');
end $$;

-- A tira o lançamento do grupo
set local role authenticated;
update public.transactions set group_id = null where id = (select v from ids where k = 'tx_m');

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta(g, 'transactions', 'UPDATE') <> 1 then
    raise exception 'FAIL: tirar lançamento do grupo não avisou group:G2';
  end if;
  perform pg_temp.mark(g, 'group_members', 'INSERT');
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000b6', 'group_members', 'INSERT');
end $$;

-- B entra em G2
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}';
do $$ begin perform public.join_group((select v from toks where k = 'inv2')); end $$;

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta(g, 'group_members', 'INSERT') <> 1 then raise exception 'FAIL: entrada não avisou group:G2'; end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000b6', 'group_members', 'INSERT') <> 1 then
    raise exception 'FAIL: entrada não avisou user:B';
  end if;
  perform pg_temp.mark(g, 'group_members', 'UPDATE');
  perform pg_temp.mark('user:00000000-0000-0000-0000-0000000000b6', 'group_members', 'UPDATE');
end $$;

-- Policy: B (membro) lê os avisos de G2; A lê os seus e não os de B; C (não membro) não lê G2
set local role authenticated;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2'); n bigint;
begin
  if (select skip from rt) then return; end if;
  perform set_config('realtime.topic', g, true);
  select count(*) into n from realtime.messages;
  if n = 0 then raise exception 'FAIL: membro B não lê avisos do grupo pela policy'; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
do $$
declare n bigint;
begin
  if (select skip from rt) then return; end if;
  perform set_config('realtime.topic', 'user:00000000-0000-0000-0000-0000000000a6', true);
  select count(*) into n from realtime.messages;
  if n = 0 then raise exception 'FAIL: A não lê os próprios avisos pela policy'; end if;
  perform set_config('realtime.topic', 'user:00000000-0000-0000-0000-0000000000b6', true);
  select count(*) into n from realtime.messages;
  if n <> 0 then raise exception 'FAIL: A lê avisos de B pela policy (%)', n; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}';
do $$
declare g text := 'group:' || (select v from ids where k = 'g2'); n bigint;
begin
  if (select skip from rt) then return; end if;
  perform set_config('realtime.topic', g, true);
  select count(*) into n from realtime.messages;
  if n <> 0 then raise exception 'FAIL: não membro C lê avisos do grupo (%)', n; end if;
end $$;

-- B sai de G2: avisa o grupo e o próprio B; depois B não lê mais o grupo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}';
do $$ begin perform public.leave_group((select v from ids where k = 'g2')); end $$;

reset role;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2');
begin
  if (select skip from rt) then return; end if;
  if pg_temp.delta(g, 'group_members', 'UPDATE') <> 1 then raise exception 'FAIL: saída não avisou group:G2'; end if;
  if pg_temp.delta('user:00000000-0000-0000-0000-0000000000b6', 'group_members', 'UPDATE') <> 1 then
    raise exception 'FAIL: saída não avisou user:B';
  end if;
end $$;

set local role authenticated;
do $$
declare g text := 'group:' || (select v from ids where k = 'g2'); n bigint;
begin
  if (select skip from rt) then return; end if;
  perform set_config('realtime.topic', g, true);
  select count(*) into n from realtime.messages;
  if n <> 0 then raise exception 'FAIL: B lê avisos do grupo depois de sair (%)', n; end if;
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
