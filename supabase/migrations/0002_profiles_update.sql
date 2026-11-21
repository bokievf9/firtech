-- Fir Tech client cabinet: make sure a client can change their own profile (2026-11-22).
-- 0001 already has these policies; this file repeats them so a project where 0001 was applied
-- partly, or where the policies were dropped by hand, is repaired. Safe to run many times.
-- Apply: Supabase dashboard -> SQL editor (paste and run), or `supabase db push`. See docs/cabinet.md.

alter table public.profiles enable row level security;

-- Without the table privilege RLS never gets a say: the update fails or touches no row.
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- The profile of an account that signed up before the trigger existed (or missed it).
insert into public.profiles (id, email)
select u.id, lower(u.email) from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
