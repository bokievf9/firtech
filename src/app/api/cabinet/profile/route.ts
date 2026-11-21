import { after } from 'next/server'
import { kindIds } from '@/content/builder-catalog'
import { reply } from '@/lib/cabinet-api'
import {
  legacyOnly,
  parseProfilePatch,
  reconcileChannel,
  rowToView,
  SAVE_ERRORS,
  saveProfilePatch,
  type ProfilesClient,
  type ProfileRow,
} from '@/lib/cabinet-profile'
import { syncProfileToHq } from '@/lib/cabinet-profile-server'
import { loadProfile } from '@/lib/cabinet-session'
import { checkPublicPost } from '@/lib/public-post'
import { createClient } from '@/lib/supabase/server'

// The cabinet profile, one field (or a few) at a time (2026-11-22). GET = the stored profile; POST
// `{ field: value }` writes the patch, reads the row back and answers it, so the page always shows what the
// database holds. HQ gets the new profile after the answer (`after`). Errors: `{ ok:false, error }` with
// the codes of lib/errors.ts: 401 unauthorized, 400 invalid / telegram_invalid / phone_invalid /
// website_invalid / niche_invalid, 409 telegram_required, 403 save_denied (RLS), 503 profile_outdated
// (migration 0003 not run) or unavailable, 504 timeout, 500 save_failed.
export const dynamic = 'force-dynamic'

const SESSION_TIMEOUT_MS = 8000

async function session() {
  const supabase = await createClient()
  if (!supabase) return { error: reply({ ok: false, error: 'unavailable' }, 503) } as const
  try {
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('supabase timeout')), SESSION_TIMEOUT_MS)),
    ])
    if (!data.user) return { error: reply({ ok: false, error: 'unauthorized' }, 401) } as const
    return { supabase, user: data.user } as const
  } catch (error) {
    console.error('[cabinet] profile session check failed:', error instanceof Error ? error.message : 'unknown')
    return { error: reply({ ok: false, error: 'timeout' }, 504) } as const
  }
}

export async function GET() {
  const s = await session()
  if ('error' in s) return s.error
  const profile = await loadProfile(s.supabase, s.user)
  if (!profile) return reply({ ok: false, error: 'save_failed' }, 500)
  return reply({ ok: true, profile: rowToView(profile as unknown as ProfileRow, s.user.email ?? ''), legacy: Boolean(profile.legacy) })
}

export async function POST(request: Request) {
  const bad = checkPublicPost(request)
  if (bad) return reply({ ok: false, error: bad.error }, bad.status)
  const s = await session()
  if ('error' in s) return s.error
  const body: unknown = await request.json().catch(() => null)
  const parsed = parseProfilePatch(body, kindIds)
  if (!parsed.ok) return reply({ ok: false, error: parsed.error, field: parsed.field }, 400)

  const current = await loadProfile(s.supabase, s.user)
  const legacy = Boolean(current?.legacy)
  if (legacy && !legacyOnly(parsed.patch)) return reply({ ok: false, error: 'profile_outdated' }, 503)
  const view = current ? rowToView(current as unknown as ProfileRow, s.user.email ?? '') : null
  const reconciled = reconcileChannel(parsed.patch, view ?? { telegram: '', notifyChannel: 'email' })
  if (!reconciled.ok) return reply({ ok: false, error: reconciled.error, field: 'notifyChannel' }, 409)
  const patch = legacy ? Object.fromEntries(Object.entries(reconciled.patch).filter(([k]) => k !== 'notifyChannel')) : reconciled.patch

  const saved = await saveProfilePatch(s.supabase as unknown as ProfilesClient, s.user, patch, { legacy })
  if (!saved.ok) {
    console.warn(`[cabinet] profile save failed (${saved.reason})`)
    const e = SAVE_ERRORS[saved.reason]
    return reply({ ok: false, error: e.code }, e.status)
  }
  const { supabase, user } = s
  after(() =>
    syncProfileToHq(user.id, saved.profile, async (at) => {
      const { error } = await supabase.from('profiles').update({ hq_synced_at: at }).eq('id', user.id)
      if (error) console.warn('[cabinet] could not store hq_synced_at')
    }),
  )
  return reply({ ok: true, profile: saved.profile, legacy })
}
