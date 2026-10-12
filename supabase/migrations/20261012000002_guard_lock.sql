-- Fecha a janela de corrida entre editar/excluir um lançamento e pagar a fatura dele:
-- trava (FOR UPDATE, em ordem de id) as faturas relacionadas antes de checar se alguma está paga.
-- A ordem fixa e o lock exclusivo evitam deadlock por upgrade de share para exclusivo.
create or replace function public.transactions_guard_paid() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.invoices v
    where v.id in (select invoice_id from public.installments where transaction_id = old.id)
    order by v.id for update;
  if exists (select 1 from auth.users u where u.id = old.user_id)
     and exists (
       select 1 from public.installments i join public.invoices v on v.id = i.invoice_id
       where i.transaction_id = old.id and v.paid_at is not null
     ) then
    raise exception 'lançamento em fatura paga' using errcode = '23514', hint = 'paid_invoice';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
