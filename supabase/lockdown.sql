-- WoofCrafts POS: lock down products, orders and product-images.
--
-- Only signed-in POS staff may change data. Staff are Supabase Auth users whose
-- app_metadata contains {"role": "pos_staff"}. app_metadata cannot be edited by
-- the user, so open sign-ups cannot grant access.
--
-- Run AFTER the new sign-in code is deployed and the staff user is marked:
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"pos_staff"}'
--   where email = 'staff@example.com';
--
-- Other apps in this project (passport_*, contact_submissions, health_check)
-- are not touched.

-- ---------------------------------------------------------------- products
drop policy if exists "Public read products" on public.products;
drop policy if exists "Public write products" on public.products;

-- Shoppers and staff can read the catalogue.
create policy "Anyone can read products"
on public.products for select
to anon, authenticated
using (true);

create policy "Staff add products"
on public.products for insert
to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff edit products"
on public.products for update
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff delete products"
on public.products for delete
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

-- TRUNCATE is not filtered by RLS, so the grant itself has to go.
revoke insert, update, delete, truncate, references, trigger on public.products from anon;

-- ------------------------------------------------------------------ orders
-- Orders hold customer names, emails and phone numbers: no public access at all.
drop policy if exists "Public read orders" on public.orders;
drop policy if exists "Public write orders" on public.orders;

create policy "Staff read orders"
on public.orders for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff add orders"
on public.orders for insert
to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

-- The invoice API writes orders with the service role key, which bypasses RLS.
revoke all on public.orders from anon;

-- ----------------------------------------------- product-images (Storage)
-- The bucket stays public, so image URLs keep working without a policy.
drop policy if exists "Public delete product-images objects 16wiy3a_0" on storage.objects;
drop policy if exists "Public delete product-images objects 16wiy3a_1" on storage.objects;
drop policy if exists "Public insert product-images objects 16wiy3a_0" on storage.objects;
drop policy if exists "Public read product-images objects 16wiy3a_0" on storage.objects;
drop policy if exists "Public update product-images objects 16wiy3a_0" on storage.objects;
drop policy if exists "Public update product-images objects 16wiy3a_1" on storage.objects;

create policy "Staff read product images"
on storage.objects for select
to authenticated
using (bucket_id = 'product-images'
       and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images'
            and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff replace product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images'
       and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff')
with check (bucket_id = 'product-images'
            and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

create policy "Staff delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images'
       and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'pos_staff');

-- Limit what can be uploaded to the bucket.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'product-images';
