-- 書き込みを管理者に限定し、profiles の読み取りを本人+管理者に限定する。
-- words / category_access の読み取りは従来どおり公開のまま。
-- 元に戻す: 2026-10-26_rollback.sql

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- words
drop policy if exists "Allow all for words" on public.words;
create policy words_select_all on public.words for select to anon, authenticated using (true);
create policy words_insert_admin on public.words for insert to authenticated with check (public.is_admin());
create policy words_update_admin on public.words for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy words_delete_admin on public.words for delete to authenticated using (public.is_admin());

-- profiles
drop policy if exists "Allow read for all" on public.profiles;
drop policy if exists "Allow insert for authenticated" on public.profiles;
drop policy if exists "Allow update own profile" on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own_or_admin on public.profiles for insert to authenticated
  with check ((id = auth.uid() and coalesce(is_admin, false) = false) or public.is_admin());
create policy profiles_update_own_or_admin on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_delete_admin on public.profiles for delete to authenticated using (public.is_admin());

-- RLSでは更新前後の値を比較できないため、is_admin の書き換えはトリガーで防ぐ。
-- SQL Editor(postgres) からの付与は対象外にしている。
create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.is_admin is distinct from old.is_admin
     and not public.is_admin() then
    raise exception 'is_admin can only be changed by an admin';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_admin_flag on public.profiles;
create trigger protect_profile_admin_flag
  before update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

-- category_access
alter table public.category_access enable row level security;
create policy category_access_select_all on public.category_access for select to anon, authenticated using (true);
create policy category_access_insert_admin on public.category_access for insert to authenticated with check (public.is_admin());
create policy category_access_update_admin on public.category_access for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy category_access_delete_admin on public.category_access for delete to authenticated using (public.is_admin());

-- storage: 音声のアップロードは管理者のみ
drop policy if exists "Authenticated users can upload audio" on storage.objects;
create policy "Admins can upload audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and public.is_admin());
