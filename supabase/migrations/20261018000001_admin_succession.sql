-- Etapa 7: um grupo nunca fica sem administrador.
-- Quando a linha do admin some (conta da pessoa apagada), o membro ativo mais antigo vira admin;
-- se não sobrar ninguém ativo, o grupo é excluído (lançamentos continuam com cada pessoa, sem grupo).
create function public.group_admin_succession() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_next uuid;
begin
  if old.role <> 'admin' or not exists (select 1 from public.groups where id = old.group_id) then
    return null;
  end if;
  select m.user_id into v_next from public.group_members m
    where m.group_id = old.group_id and m.left_at is null
    order by m.joined_at, m.user_id
    limit 1;
  if v_next is null then
    delete from public.groups where id = old.group_id;
  else
    update public.group_members set role = 'admin' where group_id = old.group_id and user_id = v_next;
  end if;
  return null;
end;
$$;
revoke execute on function public.group_admin_succession() from public, anon, authenticated;

create trigger group_members_admin_succession after delete on public.group_members
  for each row execute function public.group_admin_succession();
