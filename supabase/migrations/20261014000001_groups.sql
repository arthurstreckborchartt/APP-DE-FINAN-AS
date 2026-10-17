-- Etapa 5: grupos, convites e lançamentos compartilhados
-- Leituras do grupo passam por funções security definer: o RLS das tabelas pessoais continua "só o dono".

------------------------------------------------------------
-- Grupos e membros
------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  currency char(3) not null
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  icon text not null default 'users' check (icon ~ '^[a-z0-9-]{1,40}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  removed boolean not null default false,
  primary key (group_id, user_id),
  constraint group_members_admin_active check (role = 'member' or left_at is null)
);
create index group_members_user_idx on public.group_members (user_id) where left_at is null;
create unique index group_members_one_admin on public.group_members (group_id) where role = 'admin';

create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid()) and m.left_at is null
  )
$$;

create function public.is_group_admin(p_group uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid()) and m.left_at is null and m.role = 'admin'
  )
$$;

-- Moeda do grupo (inclusive para quem já saiu: usado na validação de lançamentos antigos).
create function public.group_currency(p_group uuid) returns char(3)
language sql stable security definer set search_path = ''
as $$ select g.currency from public.groups g where g.id = p_group $$;

revoke execute on function public.is_group_member(uuid), public.is_group_admin(uuid), public.group_currency(uuid)
  from public, anon;
grant execute on function public.is_group_member(uuid), public.is_group_admin(uuid), public.group_currency(uuid)
  to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy groups_select_member on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy groups_update_admin on public.groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy groups_delete_admin on public.groups for delete to authenticated
  using (public.is_group_admin(id));
create policy group_members_select_member on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

revoke all on public.groups, public.group_members from anon, authenticated;
grant select, delete on public.groups to authenticated;
grant update (name, icon) on public.groups to authenticated;
grant select on public.group_members to authenticated;

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- Convites
------------------------------------------------------------
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_invites_group_idx on public.group_invites (group_id);

alter table public.group_invites enable row level security;
create policy group_invites_select_admin on public.group_invites for select to authenticated
  using (public.is_group_admin(group_id));
revoke all on public.group_invites from anon, authenticated;
grant select on public.group_invites to authenticated;

------------------------------------------------------------
-- Lançamentos e recorrentes podem ser do grupo
------------------------------------------------------------
alter table public.transactions
  add column group_id uuid references public.groups (id) on delete set null;
create index transactions_group_date_idx on public.transactions (group_id, date) where group_id is not null;
grant insert (group_id), update (group_id) on public.transactions to authenticated;

alter table public.recurring
  add column group_id uuid references public.groups (id) on delete set null;
grant insert (group_id), update (group_id) on public.recurring to authenticated;

-- Só mudanças que mexem no dinheiro regeneram parcelas ou esbarram em fatura paga
-- (assim, marcar/desmarcar grupo, excluir o grupo ou a recorrente não falham em compra de fatura paga).
drop trigger transactions_guard_paid on public.transactions;
create trigger transactions_guard_paid
  before update of kind, amount, date, category_id, description, account_id, card_id, installments_count or delete
  on public.transactions
  for each row execute function public.transactions_guard_paid();

drop trigger transactions_sync_installments on public.transactions;
create trigger transactions_sync_installments
  after insert or update of kind, amount, date, account_id, card_id, installments_count
  on public.transactions
  for each row execute function public.transactions_sync_installments();

-- Validação dos lançamentos: como antes + grupo (membro ativo e mesma moeda).
create or replace function public.transactions_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src_user uuid;
  src_currency char(3);
  src_archived boolean;
  cat_user uuid;
  cat_kind text;
begin
  if new.account_id is not null then
    select a.user_id, a.currency into src_user, src_currency from public.accounts a where a.id = new.account_id;
  else
    select c.user_id, c.currency, c.archived into src_user, src_currency, src_archived
      from public.cards c where c.id = new.card_id;
  end if;
  if src_user is null or src_user <> new.user_id then
    raise exception 'origem inválida' using errcode = '23514';
  end if;
  -- Compras novas (ou movidas) não podem ir para cartão arquivado.
  if src_archived then
    if tg_op = 'INSERT' then
      raise exception 'cartão arquivado' using errcode = '23514', hint = 'archived_card';
    elsif new.card_id is distinct from old.card_id then
      raise exception 'cartão arquivado' using errcode = '23514', hint = 'archived_card';
    end if;
  end if;

  select c.user_id, c.kind into cat_user, cat_kind from public.categories c where c.id = new.category_id;
  if cat_kind is null or (cat_user is not null and cat_user <> new.user_id) then
    raise exception 'categoria inválida' using errcode = '23514';
  end if;
  if cat_kind <> new.kind then
    raise exception 'tipo da categoria diferente do lançamento' using errcode = '23514';
  end if;

  new.currency := src_currency;

  if new.group_id is not null then
    if tg_op = 'INSERT' or new.group_id is distinct from old.group_id then
      if not exists (select 1 from public.group_members m
                     where m.group_id = new.group_id and m.user_id = new.user_id and m.left_at is null) then
        raise exception 'não é membro do grupo' using errcode = '23514', hint = 'not_group_member';
      end if;
    end if;
    if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id
        or new.account_id is distinct from old.account_id or new.card_id is distinct from old.card_id)
       and public.group_currency(new.group_id) is distinct from new.currency then
      raise exception 'moeda diferente da do grupo' using errcode = '23514', hint = 'group_currency';
    end if;
  end if;
  return new;
end;
$$;

-- Validação das recorrentes: como antes + grupo.
create or replace function public.recurring_validate() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src_user uuid;
  src_currency char(3);
  src_archived boolean;
  cat_user uuid;
  cat_kind text;
  v_d date;
  v_i integer;
begin
  if new.account_id is not null then
    select a.user_id, a.currency, a.archived into src_user, src_currency, src_archived
      from public.accounts a where a.id = new.account_id;
  else
    select c.user_id, c.currency, c.archived into src_user, src_currency, src_archived
      from public.cards c where c.id = new.card_id;
  end if;
  if src_user is null or src_user <> new.user_id then
    raise exception 'origem inválida' using errcode = '23514';
  end if;
  if src_archived and (tg_op = 'INSERT'
      or new.account_id is distinct from old.account_id
      or new.card_id is distinct from old.card_id) then
    raise exception 'origem arquivada' using errcode = '23514', hint = 'archived_source';
  end if;

  select c.user_id, c.kind into cat_user, cat_kind from public.categories c where c.id = new.category_id;
  if cat_kind is null or (cat_user is not null and cat_user <> new.user_id) then
    raise exception 'categoria inválida' using errcode = '23514';
  end if;
  if cat_kind <> new.kind then
    raise exception 'tipo da categoria diferente' using errcode = '23514';
  end if;

  new.currency := src_currency;

  if new.group_id is not null then
    if tg_op = 'INSERT' or new.group_id is distinct from old.group_id then
      if not exists (select 1 from public.group_members m
                     where m.group_id = new.group_id and m.user_id = new.user_id and m.left_at is null) then
        raise exception 'não é membro do grupo' using errcode = '23514', hint = 'not_group_member';
      end if;
    end if;
    if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id
        or new.account_id is distinct from old.account_id or new.card_id is distinct from old.card_id)
       and public.group_currency(new.group_id) is distinct from new.currency then
      raise exception 'moeda diferente da do grupo' using errcode = '23514', hint = 'group_currency';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.next_date := new.start_date;
  else
    -- Troca de frequência: primeira ocorrência da nova agenda (ancorada no início) a partir da próxima data
    if new.frequency is distinct from old.frequency then
      v_d := old.start_date;
      v_i := 0;
      while v_d < old.next_date and v_i < 6000 loop
        v_d := public.recurring_next(v_d, new.frequency, old.start_date);
        v_i := v_i + 1;
      end loop;
      new.next_date := v_d;
    end if;
    -- Retomada: não gera o período pausado; avança até hoje
    if old.paused and not new.paused then
      v_d := new.next_date;
      v_i := 0;
      while v_d < current_date and v_i < 6000 loop
        v_d := public.recurring_next(v_d, new.frequency, old.start_date);
        v_i := v_i + 1;
      end loop;
      new.next_date := v_d;
    end if;
  end if;
  return new;
end;
$$;

-- Geração das recorrentes: igual à da Etapa 4, copiando o grupo.
create or replace function public.generate_recurring_for(p_user uuid, p_until date) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next date;
  v_archived boolean;
  v_created integer := 0;
  v_count integer;
  v_guard integer;
begin
  for r in
    select * from public.recurring
    where not paused and next_date <= p_until
      and (end_date is null or next_date <= end_date)
      and (p_user is null or user_id = p_user)
    order by id
    for update skip locked
  loop
    begin
      v_count := 0;
      if r.account_id is not null then
        select archived into v_archived from public.accounts where id = r.account_id;
      else
        select archived into v_archived from public.cards where id = r.card_id;
      end if;
      if v_archived then
        update public.recurring set paused = true where id = r.id;
        continue;
      end if;

      v_next := r.next_date;
      v_guard := 0;
      while v_next <= p_until and (r.end_date is null or v_next <= r.end_date) and v_guard < 500 loop
        insert into public.transactions
          (user_id, kind, amount, date, category_id, description, account_id, card_id, installments_count,
           recurring_id, recurring_date, group_id)
        values
          (r.user_id, r.kind, r.amount, v_next, r.category_id, r.description, r.account_id, r.card_id, 1,
           r.id, v_next, r.group_id)
        on conflict (recurring_id, recurring_date) where recurring_id is not null do nothing;
        if found then
          v_count := v_count + 1;
        end if;
        v_next := public.recurring_next(v_next, r.frequency, r.start_date);
        v_guard := v_guard + 1;
      end loop;

      update public.recurring set next_date = v_next where id = r.id;
      v_created := v_created + v_count;
    exception when others then
      -- uma recorrente com problema não interrompe as demais (o bloco desfaz só o que ela fez), mas fica registrada
      raise warning 'recorrente %: %', r.id, sqlerrm;
    end;
  end loop;
  return v_created;
end;
$$;
revoke execute on function public.generate_recurring_for(uuid, date) from public, anon, authenticated;

-- Competência: expõe group_id (no fim)
create or replace view public.month_entries with (security_invoker = true) as
select
  t.id as entry_id, t.id as transaction_id, t.user_id, t.kind, t.amount, t.currency,
  date_trunc('month', t.date)::date as month, t.date, t.date as purchase_date,
  t.category_id, t.description, t.account_id, t.card_id,
  1::smallint as installment_number, t.installments_count, t.amount as total_amount, t.created_at,
  t.recurring_id, t.group_id
from public.transactions t
where t.card_id is null
union all
select
  i.id, t.id, t.user_id, t.kind, i.amount, t.currency,
  i.competence_month, (t.date + make_interval(months => i.number - 1))::date, t.date,
  t.category_id, t.description, t.account_id, t.card_id,
  i.number, t.installments_count, t.amount, t.created_at,
  t.recurring_id, t.group_id
from public.installments i
join public.transactions t on t.id = i.transaction_id;

------------------------------------------------------------
-- Funções de grupo (escrita)
------------------------------------------------------------
create function public.create_group(p_name text, p_currency text, p_icon text default 'users') returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'sem usuário' using errcode = '42501';
  end if;
  insert into public.groups (name, currency, icon, created_by)
    values (btrim(p_name), p_currency, coalesce(p_icon, 'users'), v_uid)
    returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

create function public.create_group_invite(p_group uuid) returns public.group_invites
language plpgsql security definer set search_path = ''
as $$
declare
  v public.group_invites;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  insert into public.group_invites (group_id, created_by) values (p_group, auth.uid()) returning * into v;
  return v;
end;
$$;

create function public.revoke_group_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.group_invites where id = p_invite;
  if v_group is null or not public.is_group_admin(v_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  update public.group_invites set revoked_at = now() where id = p_invite and revoked_at is null;
end;
$$;

create function public.join_group(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v record;
begin
  if v_uid is null then
    raise exception 'sem usuário' using errcode = '42501';
  end if;
  select i.group_id, i.expires_at, i.revoked_at, i.created_at into v from public.group_invites i where i.token = p_token;
  if not found then
    raise exception 'convite inválido' using errcode = '23514', hint = 'invite_invalid';
  end if;
  -- quem já é membro ativo volta para o grupo, mesmo com link antigo
  if exists (select 1 from public.group_members
             where group_id = v.group_id and user_id = v_uid and left_at is null) then
    return v.group_id;
  end if;
  if v.revoked_at is not null or v.expires_at <= now() then
    raise exception 'convite expirado' using errcode = '23514', hint = 'invite_expired';
  end if;
  -- trava o grupo: contagem de membros consistente
  perform 1 from public.groups where id = v.group_id for update;
  -- removido pelo admin só volta com link criado depois da remoção
  if exists (select 1 from public.group_members
             where group_id = v.group_id and user_id = v_uid and removed and v.created_at <= left_at) then
    raise exception 'removido do grupo' using errcode = '23514', hint = 'removed_from_group';
  end if;
  if (select count(*) from public.group_members where group_id = v.group_id and left_at is null) >= 50 then
    raise exception 'grupo cheio' using errcode = '23514', hint = 'group_full';
  end if;
  insert into public.group_members (group_id, user_id, role) values (v.group_id, v_uid, 'member')
  on conflict (group_id, user_id) do update set left_at = null, removed = false, joined_at = now(), role = 'member';
  return v.group_id;
end;
$$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  select role into v_role from public.group_members
    where group_id = p_group and user_id = v_uid and left_at is null for update;
  if not found then
    raise exception 'não é membro' using errcode = '23514', hint = 'not_member';
  end if;
  if v_role = 'admin' then
    raise exception 'admin precisa transferir' using errcode = '23514', hint = 'admin_must_transfer';
  end if;
  update public.group_members set left_at = now() where group_id = p_group and user_id = v_uid;
  update public.recurring set group_id = null where user_id = v_uid and group_id = p_group;
end;
$$;

create function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  if p_user = auth.uid() then
    raise exception 'não pode remover a si mesmo' using errcode = '23514', hint = 'cannot_remove_self';
  end if;
  update public.group_members set left_at = now(), removed = true
    where group_id = p_group and user_id = p_user and left_at is null;
  if not found then
    raise exception 'não é membro' using errcode = '23514', hint = 'not_member';
  end if;
  update public.recurring set group_id = null where user_id = p_user and group_id = p_group;
end;
$$;

create function public.transfer_admin(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'só o administrador' using errcode = '42501', hint = 'not_admin';
  end if;
  if p_user = auth.uid() or not exists (
      select 1 from public.group_members where group_id = p_group and user_id = p_user and left_at is null) then
    raise exception 'não é membro' using errcode = '23514', hint = 'not_member';
  end if;
  -- rebaixa antes de promover (índice de um admin por grupo)
  update public.group_members set role = 'member' where group_id = p_group and user_id = auth.uid();
  update public.group_members set role = 'admin' where group_id = p_group and user_id = p_user;
end;
$$;

------------------------------------------------------------
-- Funções de grupo (leitura) — nunca expõem contas ou cartões
------------------------------------------------------------
create function public.my_groups()
returns table (id uuid, name text, currency char(3), icon text, role text, members integer, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.currency, g.icon, m.role,
    (select count(*)::int from public.group_members x where x.group_id = g.id and x.left_at is null),
    g.created_at
  from public.groups g
  join public.group_members m on m.group_id = g.id
  where m.user_id = (select auth.uid()) and m.left_at is null
  order by lower(g.name), g.id
$$;

create function public.group_member_list(p_group uuid)
returns table (user_id uuid, name text, role text, joined_at timestamptz, left_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, coalesce(p.name, ''), m.role, m.joined_at, m.left_at
  from public.group_members m
  left join public.profiles p on p.id = m.user_id
  where m.group_id = p_group and public.is_group_member(p_group)
  order by m.left_at nulls first, m.role, m.joined_at
$$;

create function public.group_month_entries(p_group uuid, p_month date)
returns table (
  entry_id uuid, transaction_id uuid, user_id uuid, kind text, amount bigint, currency char(3), date date,
  category_id uuid, category_name text, category_key text, category_icon text, category_color text,
  description text, is_card boolean, installment_number smallint, installments_count smallint,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select e.entry_id, e.transaction_id, e.user_id, e.kind, e.amount, e.currency, e.date,
    c.id, c.name, c.i18n_key, c.icon, c.color,
    e.description, e.card_id is not null, e.installment_number, e.installments_count, e.created_at
  from public.month_entries e
  join public.categories c on c.id = e.category_id
  where e.group_id = p_group
    and e.month = date_trunc('month', p_month)::date
    and public.is_group_member(p_group)
  order by e.date desc, e.created_at desc, e.entry_id
$$;

create function public.group_invite_preview(p_token text)
returns table (group_id uuid, name text, icon text, currency char(3), members integer, expires_at timestamptz, status text)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.icon, g.currency,
    (select count(*)::int from public.group_members m where m.group_id = g.id and m.left_at is null),
    i.expires_at,
    case
      when exists (select 1 from public.group_members m
                   where m.group_id = g.id and m.user_id = (select auth.uid()) and m.left_at is null) then 'member'
      when i.revoked_at is not null or i.expires_at <= now() then 'expired'
      when exists (select 1 from public.group_members m
                   where m.group_id = g.id and m.user_id = (select auth.uid()) and m.removed
                     and i.created_at <= m.left_at) then 'removed'
      else 'valid'
    end
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.token = p_token and (select auth.uid()) is not null
$$;

revoke execute on function
  public.create_group(text, text, text), public.create_group_invite(uuid), public.revoke_group_invite(uuid),
  public.join_group(text), public.leave_group(uuid), public.remove_member(uuid, uuid), public.transfer_admin(uuid, uuid),
  public.my_groups(), public.group_member_list(uuid), public.group_month_entries(uuid, date),
  public.group_invite_preview(text)
  from public, anon;
grant execute on function
  public.create_group(text, text, text), public.create_group_invite(uuid), public.revoke_group_invite(uuid),
  public.join_group(text), public.leave_group(uuid), public.remove_member(uuid, uuid), public.transfer_admin(uuid, uuid),
  public.my_groups(), public.group_member_list(uuid), public.group_month_entries(uuid, date),
  public.group_invite_preview(text)
  to authenticated;
