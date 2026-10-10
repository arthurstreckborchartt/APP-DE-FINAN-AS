-- Perfis de usuário: preferências pessoais (idioma, moeda, tema)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'pt-PT', 'en', 'es')),
  currency char(3) not null default 'BRL'
    check (currency in ('BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Sem policy de insert/delete: perfis são criados pelo trigger e apagados em cascata.

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, name, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 80),
    case when meta_locale in ('pt-BR', 'pt-PT', 'en', 'es') then meta_locale else 'pt-BR' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
