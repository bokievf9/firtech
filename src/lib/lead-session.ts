import 'server-only'
import { syncAfterSignIn } from './cabinet-session'
import type { LeadUser } from './lead-identity'
import { createClient } from './supabase/server'

// The signed-in client behind a lead request, from the session cookies; null when signed out.
// Also makes sure HQ knows the client (first lead right after an inline sign-up). Name: the
// profile's, else the sign-up metadata's.
export async function currentLeadUser(locale: 'ru' | 'en' = 'ru', ip?: string): Promise<LeadUser | null> {
  const supabase = await createClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return null
  const profile = await syncAfterSignIn(supabase, user, locale, ip)
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const metaName = typeof meta.name === 'string' ? meta.name : typeof meta.full_name === 'string' ? meta.full_name : ''
  return { id: user.id, email: user.email, name: profile?.name ?? metaName }
}

// Same, without the HQ sync: for the chat (every message) and /api/cabinet/me.
export async function peekLeadUser(): Promise<(LeadUser & { telegram: string }) | null> {
  const supabase = await createClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return null
  const { data: profile } = await supabase.from('profiles').select('name,telegram').eq('id', user.id).maybeSingle()
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const metaName = typeof meta.name === 'string' ? meta.name : typeof meta.full_name === 'string' ? meta.full_name : ''
  return {
    id: user.id,
    email: user.email,
    name: (profile as { name?: string | null } | null)?.name ?? metaName,
    telegram: (profile as { telegram?: string | null } | null)?.telegram ?? '',
  }
}
