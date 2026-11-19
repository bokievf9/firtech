import { NextResponse } from 'next/server'
import { fetchClientByEmail } from '@/lib/cabinet-hq'
import { createClient } from '@/lib/supabase/server'

// GET /api/cabinet/leads: the signed-in client's requests from HQ (by the session's email), for
// the cabinet's 30-second refresh. `leads: null` when HQ does not send the field.
export const dynamic = 'force-dynamic'

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } })

export async function GET() {
  const supabase = await createClient()
  if (!supabase) return reply({ ok: false, error: 'unavailable' }, 503)
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) return reply({ ok: false, error: 'unauthorized' }, 401)
  const client = await fetchClientByEmail(data.user.email)
  if (!client.ok) return reply({ ok: false, error: client.error }, client.error === 'not_found' ? 200 : 502)
  return reply({ ok: true, leads: client.data.leads })
}
