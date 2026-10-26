-- 2026-10-26_restrict_writes.sql を適用前の状態に戻す

-- words
drop policy if exists words_select_all on public.words;
drop policy if exists words_insert_admin on public.words;
drop policy if exists words_update_admin on public.words;
drop policy if exists words_delete_admin on public.words;
create policy "Allow all for words" on public.words for all to anon, authenticated using (true) with check (true);

-- profiles
drop trigger if exists protect_profile_admin_flag on public.profiles;
drop function if exists public.protect_profile_admin_flag();
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_insert_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;
create policy "Allow read for all" on public.profiles for select to anon, authenticated using (true);
create policy "Allow insert for authenticated" on public.profiles for insert to authenticated with check (true);
create policy "Allow update own profile" on public.profiles for update to authenticated using (true);

-- category_access
drop policy if exists category_access_select_all on public.category_access;
drop policy if exists category_access_insert_admin on public.category_access;
drop policy if exists category_access_update_admin on public.category_access;
drop policy if exists category_access_delete_admin on public.category_access;
alter table public.category_access disable row level security;

-- storage
drop policy if exists "Admins can upload audio" on storage.objects;
create policy "Authenticated users can upload audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio');

-- is_admin() は他から参照されなくなってから削除する
drop function if exists public.is_admin();
