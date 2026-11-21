-- Fir Tech client cabinet: profile sections and notification settings (2026-11-22, owner review items 10 and 11).
-- New columns of public.profiles, each with a default, so existing rows stay valid. Safe to run many times.
-- Apply: Supabase dashboard -> SQL editor (paste and run), or `supabase db push`. See docs/cabinet.md.
-- Until it runs, the cabinet keeps working with the old columns (name, Telegram, language, news and offers);
-- the new fields answer «база ещё не обновлена» when saved.

alter table public.profiles
  add column if not exists recommendations_consent boolean not null default false,
  add column if not exists notify_channel text not null default 'email',
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists niche text,
  add column if not exists website text,
  add column if not exists city text,
  add column if not exists legal_name text,
  add column if not exists legal_address text,
  add column if not exists refund_wallet text;

-- Allowed values and lengths (the site checks the same; these keep a hand-made write honest).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_notify_channel_check') then
    alter table public.profiles add constraint profiles_notify_channel_check
      check (notify_channel in ('email', 'telegram', 'both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_prefs_length_check') then
    alter table public.profiles add constraint profiles_prefs_length_check check (
      coalesce(length(phone), 0) <= 40
      and coalesce(length(company), 0) <= 120
      and coalesce(length(niche), 0) <= 40
      and coalesce(length(website), 0) <= 200
      and coalesce(length(city), 0) <= 80
      and coalesce(length(legal_name), 0) <= 160
      and coalesce(length(legal_address), 0) <= 300
      and coalesce(length(refund_wallet), 0) <= 120
    );
  end if;
end;
$$;

-- The same table rights and own-row policies as 0002 (a client changes only their own row).
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
