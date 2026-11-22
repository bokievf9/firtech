-- Fir Tech client cabinet: column rights on public.profiles (security review 2026-11-23, P1-3).
-- Before: `grant update on public.profiles` + the own-row policy let a signed-in client change ANY column
-- of their row, including `email` (the CRM upserts by email, so a client could overwrite someone else's
-- card in HQ) and `hq_synced_at`. After: a client may update only the profile fields of the cabinet form;
-- `id`, `email`, `hq_synced_at`, `created_at` and `updated_at` (set by the trigger) are not writable, an
-- inserted row must carry the account's own email, and `hq_synced_at` is set only through
-- `public.mark_hq_synced()` (always now(), own row only).
-- Run AFTER 0003 (columns missing from the database are skipped, so it is safe before 0003 too, but then
-- run it again after 0003). Safe to run many times.
-- Apply: Supabase dashboard -> SQL editor (paste and run), or `supabase db push`. See docs/cabinet.md.

alter table public.profiles enable row level security;

revoke update on public.profiles from authenticated, anon;
revoke insert on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;

-- The columns the cabinet's profile form writes (lib/cabinet-profile.ts FIELD_COLUMNS). Never email, id,
-- hq_synced_at, created_at or updated_at.
do $$
declare
  col text;
  editable text[] := array[
    'name', 'telegram', 'locale', 'marketing_consent',
    'recommendations_consent', 'notify_channel', 'phone', 'company', 'niche', 'website', 'city',
    'legal_name', 'legal_address', 'refund_wallet'
  ];
begin
  foreach col in array editable loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = col
    ) then
      execute format('grant update (%I) on public.profiles to authenticated', col);
      execute format('grant insert (%I) on public.profiles to authenticated', col);
    end if;
  end loop;
end;
$$;

-- The fallback insert of a missing row (the sign-up trigger normally creates it) needs id and email.
grant insert (id, email) on public.profiles to authenticated;

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- HQ has accepted the client: the site stamps the caller's own row. The value is always now().
create or replace function public.mark_hq_synced()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.profiles set hq_synced_at = now() where id = auth.uid() returning hq_synced_at;
$$;

revoke all on function public.mark_hq_synced() from public, anon;
grant execute on function public.mark_hq_synced() to authenticated;
