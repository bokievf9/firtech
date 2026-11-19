import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { syncClientToHq } from './cabinet-hq'
import { createClient } from './supabase/server'

export type Profile = {
  id: string
  email: string
  name: string | null
  telegram: string | null
  locale: string | null
  marketing_consent: boolean | null
  hq_synced_at: string | null
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
  const columns = 'id,email,name,telegram,locale,marketing_consent,hq_synced_at'
  const found = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle()
  if (found.data) return found.data as Profile
  if (found.error || !user.email) return null
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const name = typeof meta.name === 'string' ? meta.name : typeof meta.full_name === 'string' ? meta.full_name : null
  const created = await supabase
    .from('profiles')
    .insert({ id: user.id, email: user.email.toLowerCase(), name, locale: meta.locale === 'en' ? 'en' : 'ru' })
    .select(columns)
    .maybeSingle()
  return (created.data as Profile | null) ?? null
}

// Tells HQ about the client once: only while `hq_synced_at` is null, and a failure is only logged
// so the next cabinet load tries again.
export async function ensureHqSync(supabase: SupabaseClient, user: User, profile: Profile | null) {
  if (!profile || profile.hq_synced_at) return profile
  const result = await syncClientToHq(user.id, profile)
  if (!result.ok) {
    console.warn(`[cabinet] HQ client sync failed (${result.error})`)
    return profile
  }
  const at = new Date().toISOString()
  const { error } = await supabase.from('profiles').update({ hq_synced_at: at }).eq('id', user.id)
  if (error) console.warn('[cabinet] could not store hq_synced_at')
  return { ...profile, hq_synced_at: at }
}
