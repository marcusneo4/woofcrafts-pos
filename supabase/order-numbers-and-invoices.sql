-- WoofCrafts POS: sequential 6-digit order numbers, delivery fee, invoice storage.
-- Order numbers start at 001000 and go up by one for every new order.

create sequence if not exists public.order_number_seq start with 1000 minvalue 1000;

alter table public.orders add column if not exists delivery_fee numeric(10,2) not null default 0;

-- Only POS staff can take a number (same role check as the table policies).
create or replace function public.next_order_id()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'pos_staff' then
    raise exception 'Only POS staff can create orders' using errcode = '42501';
  end if;
  return lpad(nextval('public.order_number_seq')::text, 6, '0');
end;
$$;

revoke all on function public.next_order_id() from public, anon;
grant execute on function public.next_order_id() to authenticated;
revoke all on sequence public.order_number_seq from public, anon;
grant usage on sequence public.order_number_seq to authenticated;

-- Private bucket for invoice PDFs, saved as <yyyy-mm-dd>/<file>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy "Staff read invoices" on storage.objects for select to authenticated
using (bucket_id = 'invoices' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff upload invoices" on storage.objects for insert to authenticated
with check (bucket_id = 'invoices' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff replace invoices" on storage.objects for update to authenticated
using (bucket_id = 'invoices' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff')
with check (bucket_id = 'invoices' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');
