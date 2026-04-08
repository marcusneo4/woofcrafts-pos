-- Supabase schema for WoofCrafts POS
-- Target: enable public (anon) CRUD for `public.products` and public Storage access for `product-images`.
--
-- IMPORTANT:
-- 1) Create the Storage bucket `product-images` in the Supabase Dashboard first.
-- 2) Adjust/lock down policies later when you move beyond "simple-anon" demo mode.
-- 3) Run this SQL in the Supabase SQL editor (project: "WoofCrafts POS").

-- Enable UUID generation (for default id generation)
create extension if not exists pgcrypto;

-- Products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price numeric not null check (price >= 0),
  category text,
  image_url text,
  created_at timestamptz not null default now()
);

-- Enable RLS for table
alter table public.products enable row level security;

-- Simple-anon policies: public can read and write.
-- (Demo mode; replace with real auth + RLS in production.)
drop policy if exists "Public read products" on public.products;
create policy "Public read products"
on public.products
for select
using (true);

drop policy if exists "Public write products" on public.products;
create policy "Public write products"
on public.products
for all
using (true)
with check (true);

-- Storage bucket permissions
-- Bucket must be created in the dashboard: `product-images`
-- Then enable RLS and create policies on storage.objects to allow:
-- - anon select (read public URLs)
-- - anon insert/update/delete (admin can CRUD images)
alter table storage.objects enable row level security;

-- Select (read)
drop policy if exists "Public read product-images objects" on storage.objects;
create policy "Public read product-images objects"
on storage.objects
for select
using (bucket_id = 'product-images');

-- Insert
drop policy if exists "Public insert product-images objects" on storage.objects;
create policy "Public insert product-images objects"
on storage.objects
for insert
with check (bucket_id = 'product-images');

-- Update
drop policy if exists "Public update product-images objects" on storage.objects;
create policy "Public update product-images objects"
on storage.objects
for update
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

-- Delete
drop policy if exists "Public delete product-images objects" on storage.objects;
create policy "Public delete product-images objects"
on storage.objects
for delete
using (bucket_id = 'product-images');

-- Optional (nice-to-have):
-- Ensure your bucket/object visibility is compatible with "public URLs".
-- If public URLs don't work, configure "Public access" (or appropriate bucket settings)
-- in Supabase Storage dashboard.

