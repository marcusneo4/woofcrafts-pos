-- WoofCrafts POS upgrade (16 Nov 2026): order detail columns, editable notes with history, order photos.
-- Already applied to the live project. Kept here as the record of what changed.
-- Additive only: no column, row or policy is dropped.

-- Safety copy of every order taken before this upgrade.
create table if not exists public.orders_backup_20261116 as select * from public.orders;
alter table public.orders_backup_20261116 enable row level security;
revoke all on public.orders_backup_20261116 from anon, authenticated;

alter table public.orders
  add column if not exists pet_name text,
  add column if not exists address text,
  add column if not exists ring_colour text,
  add column if not exists photo_paths text[] not null default '{}',
  add column if not exists delivery_method text,
  add column if not exists notes_edited_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_ring_colour_check') then
    alter table public.orders add constraint orders_ring_colour_check
      check (ring_colour is null or ring_colour in ('silver', 'gold', 'gun metal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_method_check') then
    alter table public.orders add constraint orders_delivery_method_check
      check (delivery_method is null or delivery_method in ('delivery', 'pickup'));
  end if;
end $$;

-- Every edit to an order's notes or details keeps the previous text here.
create table if not exists public.order_note_history (
  id bigint generated always as identity primary key,
  order_uuid uuid not null references public.orders(id),
  field text not null,
  old_value text,
  new_value text,
  edited_at timestamptz not null default now(),
  edited_by uuid
);
create index if not exists order_note_history_order_uuid_idx on public.order_note_history (order_uuid);
alter table public.order_note_history enable row level security;
revoke all on public.order_note_history from anon, authenticated;
grant select on public.order_note_history to authenticated;

drop policy if exists "Staff read order note history" on public.order_note_history;
create policy "Staff read order note history"
on public.order_note_history for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

-- Written by trigger only, so the history cannot be skipped or edited from the app.
create or replace function public.orders_keep_note_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed boolean := false;
begin
  if new.customer_comment is distinct from old.customer_comment then
    insert into public.order_note_history (order_uuid, field, old_value, new_value, edited_by)
    values (old.id, 'notes', old.customer_comment, new.customer_comment, (select auth.uid()));
    changed := true;
  end if;
  if new.customer_name is distinct from old.customer_name then
    insert into public.order_note_history (order_uuid, field, old_value, new_value, edited_by)
    values (old.id, 'owner_name', old.customer_name, new.customer_name, (select auth.uid()));
    changed := true;
  end if;
  if new.pet_name is distinct from old.pet_name then
    insert into public.order_note_history (order_uuid, field, old_value, new_value, edited_by)
    values (old.id, 'pet_name', old.pet_name, new.pet_name, (select auth.uid()));
    changed := true;
  end if;
  if new.address is distinct from old.address then
    insert into public.order_note_history (order_uuid, field, old_value, new_value, edited_by)
    values (old.id, 'address', old.address, new.address, (select auth.uid()));
    changed := true;
  end if;
  if new.ring_colour is distinct from old.ring_colour then
    insert into public.order_note_history (order_uuid, field, old_value, new_value, edited_by)
    values (old.id, 'ring_colour', old.ring_colour, new.ring_colour, (select auth.uid()));
    changed := true;
  end if;
  if changed then
    new.notes_edited_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.orders_keep_note_history() from public, anon, authenticated;

drop trigger if exists orders_keep_note_history on public.orders;
create trigger orders_keep_note_history
before update on public.orders
for each row execute function public.orders_keep_note_history();

-- Staff may edit notes and details only. Order number, items and money stay as issued.
-- Orders cannot be deleted from the app.
revoke update, delete, truncate on public.orders from authenticated;
grant update (customer_comment, customer_name, pet_name, address, ring_colour, photo_paths) on public.orders to authenticated;

drop policy if exists "Staff edit order notes" on public.orders;
create policy "Staff edit order notes"
on public.orders for update
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

-- Private bucket for optional order photos, saved as <yyyy-mm-dd>/<order no>-<timestamp>-<n>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-photos', 'order-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "Staff read order photos" on storage.objects;
create policy "Staff read order photos" on storage.objects for select to authenticated
using (bucket_id = 'order-photos' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

drop policy if exists "Staff upload order photos" on storage.objects;
create policy "Staff upload order photos" on storage.objects for insert to authenticated
with check (bucket_id = 'order-photos' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');
