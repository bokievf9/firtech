import 'server-only'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { fetchClientByEmail, patchClientProfile, syncClientToHq } from './cabinet-hq'
import { hqProfileBody, PROFILE_COLUMNS, BASE_PROFILE_COLUMNS, rowToView, failureOf, type ProfileRow, type ProfileView } from './cabinet-profile'
import { supabaseConfig } from './supabase/config'
import { UNSUB_COLUMNS, unsubscribeSecret, verifyUnsubscribeToken, type UnsubField } from './unsubscribe'

type Stamp = (at: string) => PromiseLike<unknown>

// The CRM gets the saved profile: a known client through `POST /admin/clients/:id` (only changed data,
// never the registration upsert, which overwrites name and Telegram from sign-up data), an unknown one is
// registered. Never throws; a failure is logged and the next save or cabinet load tries again.
export async function syncProfileToHq(userId: string, profile: ProfileView, stamp?: Stamp): Promise<boolean> {
  try {
    const email = profile.email.toLowerCase()
    if (!email) return false
    const known = await fetchClientByEmail(email)
    const synced = known.ok
      ? await patchClientProfile(known.data.client.id, hqProfileBody(profile))
      : known.error === 'not_found'
        ? await syncClientToHq(userId, {
            email,
            name: profile.name,
            telegram: profile.telegram,
            locale: profile.locale,
            marketing_consent: profile.marketing,
            recommendations_consent: profile.recommendations,
            notify_channel: profile.notifyChannel,
            phone: profile.phone,
            company: profile.company,
          })
        : known
    if (!synced.ok) {
      console.warn(`[cabinet] HQ profile sync failed (${synced.error})`)
      return false
    }
    if (stamp) await stamp(new Date().toISOString())
    return true
  } catch {
    console.warn('[cabinet] HQ profile sync threw')
    return false
  }
}

export type UnsubResult =
  | { ok: true; field: UnsubField; already: boolean }
  | { ok: false; error: 'invalid_token' | 'not_configured' | 'not_found' | 'save_failed' }

// The token's setting off, with the service role (no session: the link comes from a letter).
export async function applyUnsubscribe(token: string | null | undefined): Promise<UnsubResult> {
  const secret = unsubscribeSecret()
  if (!secret) return { ok: false, error: 'not_configured' }
  const parsed = verifyUnsubscribeToken(token, secret)
  if (!parsed) return { ok: false, error: 'invalid_token' }
  const config = supabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!config || !serviceKey) return { ok: false, error: 'not_configured' }
  const admin = createAdminClient(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const column = UNSUB_COLUMNS[parsed.field]
  const before = await admin.from('profiles').select(column).eq('id', parsed.userId).maybeSingle()
  if (before.error) {
    console.warn(`[cabinet] unsubscribe read failed (${failureOf(before.error)})`)
    return { ok: false, error: 'save_failed' }
  }
  if (!before.data) return { ok: false, error: 'not_found' }
  if ((before.data as unknown as Record<string, unknown>)[column] === false) return { ok: true, field: parsed.field, already: true }
  let updated = await admin.from('profiles').update({ [column]: false }).eq('id', parsed.userId).select(PROFILE_COLUMNS)
  if (updated.error && failureOf(updated.error) === 'schema') {
    updated = await admin.from('profiles').update({ [column]: false }).eq('id', parsed.userId).select(BASE_PROFILE_COLUMNS)
  }
  const row = updated.data?.[0] as ProfileRow | undefined
  if (updated.error || !row) {
    console.warn(`[cabinet] unsubscribe write failed (${updated.error ? failureOf(updated.error) : 'no_row'})`)
    return { ok: false, error: 'save_failed' }
  }
  await syncProfileToHq(parsed.userId, rowToView(row))
  return { ok: true, field: parsed.field, already: false }
}
