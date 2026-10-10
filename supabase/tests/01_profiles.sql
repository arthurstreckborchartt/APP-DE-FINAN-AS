-- RLS de perfis. Tudo é desfeito no rollback final.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-profile-a@test.invalid', '{"name":"A","locale":"en"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'rls-profile-b@test.invalid', '{}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

do $$
declare
  n int;
  loc text;
  failed boolean := false;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: A vê % perfis', n; end if;

  select locale into loc from public.profiles;
  if loc <> 'en' then raise exception 'FAIL: locale do cadastro não aplicado (%)', loc; end if;

  update public.profiles set name = 'hack' where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A alterou o perfil de B'; end if;

  begin
    update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: created_at pode ser alterado'; end if;
end $$;

set local role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform 1 from public.profiles;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon lê profiles'; end if;
end $$;

select 'PASS' as result;
rollback;
