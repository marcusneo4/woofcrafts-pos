-- Round 2: adaptive order form, per-tag details, payment method, order status.
-- ADDITIVE ONLY: new columns, new table, new trigger, wider column-level UPDATE grant.
-- Nothing is dropped, deleted or rewritten. Existing orders keep NULL in every new column.
-- (Applied to project fsbehijyxypruzfdhxxo on 16 Nov 2026; kept here as a record.)

alter table public.orders
  add column if not exists fulfilment text,
  add column if not exists payment_method text,
  add column if not exists status text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists tags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfilment_check') then
    alter table public.orders add constraint orders_fulfilment_check
      check (fulfilment is null or fulfilment in ('taken_now', 'collect', 'delivery'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_method_check') then
    alter table public.orders add constraint orders_payment_method_check
      check (payment_method is null or payment_method in ('paynow', 'cash'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table public.orders add constraint orders_status_check
      check (status is null or status in ('to_make', 'made', 'collected', 'posted', 'void'));
  end if;
end $$;

-- Which products ask for engraving details (pet name, ring colour, front, back).
alter table public.products add column if not exists needs_details boolean;
update public.products set needs_details = true
  where needs_details is null and lower(coalesce(category, '')) in ('tags', 'christmas')
    and lower(title) like '%tag%';
update public.products set needs_details = false where needs_details is null;

-- Every status change is kept with its time and who made it.
create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_uuid uuid not null references public.orders(id),
  old_status text,
  new_status text,
  note text,
  changed_at timestamptz not null default now(),
  changed_by uuid
);
create index if not exists order_status_history_order_uuid_idx on public.order_status_history (order_uuid);
alter table public.order_status_history enable row level security;
revoke all on public.order_status_history from anon, authenticated;
grant select on public.order_status_history to authenticated;

drop policy if exists "Staff read order status history" on public.order_status_history;
create policy "Staff read order status history"
on public.order_status_history for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

-- Written by trigger only.
create or replace function public.orders_keep_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_uuid, old_status, new_status, note, changed_by)
    values (old.id, old.status, new.status, case when new.status = 'void' then new.void_reason end, (select auth.uid()));
    new.status_changed_at := now();
    if new.status = 'void' then
      new.voided_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.orders_keep_status_history() from public, anon, authenticated;

drop trigger if exists orders_keep_status_history on public.orders;
create trigger orders_keep_status_history
before update on public.orders
for each row execute function public.orders_keep_status_history();

-- Keep the previous per-tag details too (ignoring the "made" ticks, which are tracked as status).
create or replace function public.orders_keep_tag_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_tags jsonb;
  new_tags jsonb;
begin
  if new.tags is distinct from old.tags then
    select coalesce(jsonb_agg(t - 'made'), '[]'::jsonb) into old_tags from jsonb_array_elements(old.tags) t;
    select coalesce(jsonb_agg(t - 'made'), '[]'::jsonb) into new_tags from jsonb_array_elements(new.tags) t;
    if old_tags is distinct from new_tags then
      insert into public.order_note_history (order_uuid, field, old_value, new_value, edited_by)
      values (old.id, 'tag_details', old_tags::text, new_tags::text, (select auth.uid()));
      new.notes_edited_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.orders_keep_tag_history() from public, anon, authenticated;

drop trigger if exists orders_keep_tag_history on public.orders;
create trigger orders_keep_tag_history
before update on public.orders
for each row execute function public.orders_keep_tag_history();

-- Staff may additionally change status, void reason, payment method and per-tag details.
-- Items, prices, totals and order number stay as issued. Orders still cannot be deleted.
grant update (status, void_reason, payment_method, tags) on public.orders to authenticated;
