-- Supabase schema for WoofCrafts POS purchase logging
-- Target: add `public.orders` for invoice/order history.
--
-- Run this SQL in the same Supabase project where you installed `supabase/schema.sql`.
-- This follows the same "simple-anon" demo policy approach as `schema.sql`.

-- Orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_comment text,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  total numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.orders enable row level security;

-- Simple-anon: allow anyone to read/write orders (demo only)
drop policy if exists "Public read orders" on public.orders;
create policy "Public read orders"
on public.orders
for select
using (true);

drop policy if exists "Public write orders" on public.orders;
create policy "Public write orders"
on public.orders
for all
using (true)
with check (true);

