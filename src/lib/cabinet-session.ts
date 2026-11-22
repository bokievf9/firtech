import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { syncClientToHq } from './cabinet-hq'
import { BASE_PROFILE_COLUMNS, PROFILE_COLUMNS } from './cabinet-profile'
import { forwardSiteEvent } from './events-hq'
import { createClient } from './supabase/server'

export type Profile = {
  id: string
  email: string
  name: string | null
  telegram: string | null
  locale: string | null
  marketing_consent: boolean | null
  hq_synced_at: string | null
  updated_at?: string | null
  // Columns of migration 0003 (absent until the owner runs it).
  phone?: string | null
  company?: string | null
  niche?: string | null
  website?: string | null
  city?: string | null
  legal_name?: string | null
  legal_address?: string | null
  refund_wallet?: string | null
  recommendations_consent?: boolean | null
  notify_channel?: string | null
  // True when the database has no 0003 columns yet: the profile UI says so and saves only the old fields.
  legacy?: boolean
}

// A select that names a column the table does not have (migration 0003 not run yet).
const missingColumn = (error: unknown) => {
  const e = (error ?? {}) as { code?: unknown; message?: unknown }
  return e.code === '42703' || e.code === 'PGRST204' || /does not exist/i.test(String(e.message ?? ''))
}

// The signed-in user of a cabinet page, or a redirect to the login page of this locale.
export async function requireCabinetUser(locale: string): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createClient()
  if (!supabase) redirect(`/${locale}/cabinet`)
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect(`/${locale}/cabinet/login`)
  return { supabase, user: data.user }
}

// Reads the profile; creates it from the auth user when the sign-up trigger has not (RLS allows
// inserting one's own row).
export async function loadProfile(supabase: SupabaseClient, user: User): Promise<Profile | null> {
  let columns = PROFILE_COLUMNS
  let legacy = false
  let found = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle()
  if (found.error && missingColumn(found.error)) {
    legacy = true
    columns = BASE_PROFILE_COLUMNS
    found = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle()
  }
  if (found.data) return { ...(found.data as unknown as Profile), legacy }
  if (found.error || !user.email) return null
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const name = typeof meta.name === 'string' ? meta.name : typeof meta.full_name === 'string' ? meta.full_name : null
  const created = await supabase
    .from('profiles')
    .insert({ id: user.id, email: user.email.toLowerCase(), name, locale: meta.locale === 'en' ? 'en' : 'ru' })
    .select(columns)
    .maybeSingle()
  return created.data ? { ...(created.data as unknown as Profile), legacy } : null
}

// Tells HQ about the client once: only while `hq_synced_at` is null, and a failure is only logged
// so the next cabinet load tries again.
export async function ensureHqSync(supabase: SupabaseClient, user: User, profile: Profile | null) {
  if (!profile || profile.hq_synced_at) return profile
  const result = await syncClientToHq(user, profile)
  if (!result.ok) {
    console.warn(`[cabinet] HQ client sync failed (${result.error})`)
    return profile
  }
  const at = await markHqSynced(supabase, user.id)
  return { ...profile, hq_synced_at: at }
}

// Stamps `hq_synced_at` of the caller's own row. Since migration 0004 the column is not writable by a
// client: `public.mark_hq_synced()` (security definer, always now()) does it. Before 0004 the function is
// missing and the old direct update still works. Never throws; returns the time to keep in memory.
export async function markHqSynced(supabase: SupabaseClient, userId: string): Promise<string> {
  const at = new Date().toISOString()
  try {
    const rpc = await supabase.rpc('mark_hq_synced')
    if (!rpc.error) return typeof rpc.data === 'string' ? rpc.data : at
    const { error } = await supabase.from('profiles').update({ hq_synced_at: at }).eq('id', userId)
    if (error) console.warn('[cabinet] could not store hq_synced_at')
  } catch {
    console.warn('[cabinet] could not store hq_synced_at')
  }
  return at
}

// After any sign-in (callback, the cabinet page, a lead sent right after an inline sign-in): the
// profile exists, HQ knows the client, and the first successful sync counts one `cabinet_signup`
// (пульт «Цифры», no personal data). Never throws.
export async function syncAfterSignIn(supabase: SupabaseClient, user: User, locale: 'ru' | 'en', ip?: string) {
  try {
    const profile = await loadProfile(supabase, user)
    const synced = await ensureHqSync(supabase, user, profile)
    if (profile && !profile.hq_synced_at && synced?.hq_synced_at) {
      void forwardSiteEvent({ name: 'cabinet_signup', locale, path: `/${locale}/cabinet` }, ip)
    }
    return synced
  } catch {
    console.warn('[cabinet] sync after sign-in failed')
    return null
  }
}
