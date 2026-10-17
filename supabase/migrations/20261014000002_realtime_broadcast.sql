-- Tempo real por canais privados: cada pessoa ouve só "user:<seu id>" e "group:<id>" dos grupos em que está.
-- Substitui postgres_changes (cujo DELETE sem filtro entregava chaves de registros de outros usuários).

create function public.realtime_can_listen(p_topic text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  if p_topic = 'user:' || (select auth.uid())::text then
    return true;
  end if;
  if p_topic ~ '^group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.is_group_member(substr(p_topic, 7)::uuid);
  end if;
  return false;
end;
$$;
revoke execute on function public.realtime_can_listen(text) from public, anon;
grant execute on function public.realtime_can_listen(text) to authenticated;

create policy finance_private_listen on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.realtime_can_listen((select realtime.topic())));

-- Envia um aviso sem dados; falha no envio nunca desfaz a escrita.
create function public.notify_topic(p_topic text, p_table text, p_op text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('table', p_table, 'op', p_op), 'changed', p_topic, true);
exception when others then
  raise warning 'realtime %: %', p_topic, sqlerrm;
end;
$$;
revoke execute on function public.notify_topic(text, text, text) from public, anon, authenticated;

create function public.broadcast_owner_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  perform public.notify_topic('user:' || v_user::text, tg_table_name, tg_op);
  if tg_table_name = 'transactions' then
    if tg_op <> 'INSERT' and old.group_id is not null then
      perform public.notify_topic('group:' || old.group_id::text, tg_table_name, tg_op);
    end if;
    if tg_op <> 'DELETE' and new.group_id is not null
       and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id) then
      perform public.notify_topic('group:' || new.group_id::text, tg_table_name, tg_op);
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.broadcast_owner_change() from public, anon, authenticated;

create trigger transactions_broadcast after insert or update or delete on public.transactions
  for each row execute function public.broadcast_owner_change();
create trigger invoices_broadcast after insert or update or delete on public.invoices
  for each row execute function public.broadcast_owner_change();
create trigger cards_broadcast after insert or update or delete on public.cards
  for each row execute function public.broadcast_owner_change();
create trigger recurring_broadcast after insert or update or delete on public.recurring
  for each row execute function public.broadcast_owner_change();
create trigger accounts_broadcast after insert or update or delete on public.accounts
  for each row execute function public.broadcast_owner_change();

create function public.broadcast_group_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'group_members' then
    perform public.notify_topic('group:' || coalesce(new.group_id, old.group_id)::text, tg_table_name, tg_op);
    perform public.notify_topic('user:' || coalesce(new.user_id, old.user_id)::text, tg_table_name, tg_op);
  else
    perform public.notify_topic('group:' || coalesce(new.id, old.id)::text, tg_table_name, tg_op);
  end if;
  return null;
end;
$$;
revoke execute on function public.broadcast_group_change() from public, anon, authenticated;

create trigger group_members_broadcast after insert or update or delete on public.group_members
  for each row execute function public.broadcast_group_change();
create trigger groups_broadcast after update or delete on public.groups
  for each row execute function public.broadcast_group_change();

alter publication supabase_realtime drop table public.transactions, public.invoices, public.cards, public.recurring;
