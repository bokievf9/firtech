-- Fir Tech client cabinet: one profile per Supabase auth user.
-- Apply: Supabase dashboard -> SQL editor (paste and run), or `supabase db push`. See docs/cabinet.md.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text,
  telegram text,
  locale text not null default 'ru' check (locale in ('ru', 'en')),
  marketing_consent boolean not null default false,
  -- Set once HQ has accepted the client (POST /admin/clients). Null = sync again on the next cabinet load.
  hq_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user sees, creates (fallback when the trigger missed) and changes only their own row.
-- No delete policy: the row goes away with the auth user (on delete cascade).
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

-- Creates the profile when someone signs up (email or Google/Apple). The sign-up form passes
-- name, locale, telegram and marketing_consent in the user metadata; Google and Apple pass
-- name or full_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  picked_locale text := case when meta ->> 'locale' = 'en' then 'en' else 'ru' end;
begin
  insert into public.profiles (id, email, name, telegram, locale, marketing_consent)
  values (
    new.id,
    lower(new.email),
    nullif(left(coalesce(meta ->> 'name', meta ->> 'full_name'), 80), ''),
    nullif(left(meta ->> 'telegram', 33), ''),
    picked_locale,
    coalesce(meta ->> 'marketing_consent', 'false') = 'true'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
