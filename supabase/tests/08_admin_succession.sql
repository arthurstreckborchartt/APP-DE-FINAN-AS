-- Sucessão de administrador: o grupo nunca fica sem admin. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'succ-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b8', 'succ-b@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c8', 'succ-c@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d8', 'succ-d@test.invalid'),
  ('00000000-0000-0000-0000-0000000000e8', 'succ-e@test.invalid');

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create temp table toks (k text primary key, v text) on commit drop;
grant all on toks to authenticated;

set local role authenticated;

------------------------------------------------------------
-- A cria G; B e C entram; D cria H; E entra em H, lança e sai
------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';
do $$
declare g uuid; inv public.group_invites;
begin
  g := public.create_group('Casa', 'BRL', 'home');
  insert into ids values ('g', g);
  inv := public.create_group_invite(g);
  insert into toks values ('inv_g', inv.token);
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';
do $$ begin perform public.join_group((select v from toks where k = 'inv_g')); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c8","role":"authenticated"}';
do $$ begin perform public.join_group((select v from toks where k = 'inv_g')); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d8","role":"authenticated"}';
do $$
declare h uuid; inv public.group_invites;
begin
  h := public.create_group('Solo', 'BRL', 'users');
  insert into ids values ('h', h);
  inv := public.create_group_invite(h);
  insert into toks values ('inv_h', inv.token);
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e8","role":"authenticated"}';
do $$
declare h uuid; acc uuid; food uuid; tx uuid;
begin
  h := (select v from ids where k = 'h');
  perform public.join_group((select v from toks where k = 'inv_h'));
  select id into food from public.categories where i18n_key = 'food';
  insert into public.accounts (name, type, currency, initial_balance) values ('Banco E', 'checking', 'BRL', 0) returning id into acc;
  insert into public.transactions (kind, amount, date, category_id, account_id, group_id)
    values ('expense', 100, '2026-03-20', food, acc, h) returning id into tx;
  insert into ids values ('tx_e', tx);
  perform public.leave_group(h);
end $$;

------------------------------------------------------------
-- Como dono do banco: B entrou antes de C; apaga a conta de A (admin de G) e a de D (admin sozinho de H)
------------------------------------------------------------
reset role;
do $$
declare g uuid; h uuid; n int; r record;
begin
  g := (select v from ids where k = 'g');
  h := (select v from ids where k = 'h');
  -- na mesma transação o joined_at empata: fixa a ordem de entrada
  update public.group_members set joined_at = now() - interval '2 days'
    where group_id = g and user_id = '00000000-0000-0000-0000-0000000000b8';
  update public.group_members set joined_at = now() - interval '1 day'
    where group_id = g and user_id = '00000000-0000-0000-0000-0000000000c8';

  delete from auth.users where id = '00000000-0000-0000-0000-0000000000a8';

  if not exists (select 1 from public.groups where id = g) then raise exception 'FAIL: grupo G sumiu'; end if;
  select count(*) into n from public.group_members where group_id = g and role = 'admin';
  if n <> 1 then raise exception 'FAIL: G tem % admins', n; end if;
  if (select role from public.group_members where group_id = g and user_id = '00000000-0000-0000-0000-0000000000b8') <> 'admin' then
    raise exception 'FAIL: B (mais antigo) não virou admin';
  end if;
  if (select role from public.group_members where group_id = g and user_id = '00000000-0000-0000-0000-0000000000c8') <> 'member' then
    raise exception 'FAIL: C deixou de ser membro';
  end if;
  select count(*) into n from public.group_members where group_id = g;
  if n <> 2 then raise exception 'FAIL: G tem % membros', n; end if;

  -- D sozinho: o grupo H é excluído; o lançamento de E (que já tinha saído) continua, sem grupo
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000d8';
  if exists (select 1 from public.groups where id = h) then raise exception 'FAIL: grupo H continua existindo'; end if;
  select * into r from public.transactions where id = (select v from ids where k = 'tx_e');
  if r.id is null then raise exception 'FAIL: lançamento de E sumiu'; end if;
  if r.group_id is not null then raise exception 'FAIL: lançamento de E ainda aponta para H'; end if;
end $$;

------------------------------------------------------------
-- Remover membro comum não muda o admin
------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';
do $$ begin perform public.remove_member((select v from ids where k = 'g'), '00000000-0000-0000-0000-0000000000c8'); end $$;
reset role;
do $$
declare g uuid;
begin
  g := (select v from ids where k = 'g');
  if (select count(*) from public.group_members where group_id = g and role = 'admin' and user_id = '00000000-0000-0000-0000-0000000000b8') <> 1 then
    raise exception 'FAIL: remover membro comum mudou o admin';
  end if;
  if not exists (select 1 from public.group_members where group_id = g and user_id = '00000000-0000-0000-0000-0000000000c8' and removed) then
    raise exception 'FAIL: C não ficou removido';
  end if;
end $$;

------------------------------------------------------------
-- Sem sucessor ativo (só removido resta): apagar o admin exclui o grupo
------------------------------------------------------------
do $$
declare g uuid;
begin
  g := (select v from ids where k = 'g');
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000b8';
  if exists (select 1 from public.groups where id = g) then raise exception 'FAIL: grupo sem ativos não foi excluído'; end if;
  if exists (select 1 from public.group_members where group_id = g) then raise exception 'FAIL: sobraram membros do grupo excluído'; end if;
end $$;

------------------------------------------------------------
-- Admin exclui o grupo inteiro: o gatilho não atrapalha
------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e8","role":"authenticated"}';
do $$
declare g2 uuid; n int;
begin
  g2 := public.create_group('Outro', 'BRL', 'users');
  delete from public.groups where id = g2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin não excluiu o grupo'; end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.group_members where user_id = '00000000-0000-0000-0000-0000000000e8' and role = 'admin') then
    raise exception 'FAIL: sobrou admin órfão';
  end if;
end $$;

-- A função do gatilho não é chamável por quem usa o app
set local role authenticated;
do $$
begin
  begin
    perform public.group_admin_succession();
    raise exception 'FAIL: authenticated executa a função do gatilho';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
select 'PASS' as result;
