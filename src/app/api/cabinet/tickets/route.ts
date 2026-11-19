import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClientTicket, fetchClientByEmail, syncClientToHq } from '@/lib/cabinet-hq'
import { loadProfile } from '@/lib/cabinet-session'
import { checkPublicPost } from '@/lib/public-post'
import { createClient } from '@/lib/supabase/server'

// POST /api/cabinet/tickets  { text }: a signed-in client writes to support. The client is found
// in HQ by the session's email, never by anything the browser sends.
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ text: z.string().trim().min(3).max(1000) })
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request) {
  const bad = checkPublicPost(request)
  if (bad) return reply({ ok: false, error: bad.error }, bad.status)
  const supabase = await createClient()
  if (!supabase) return reply({ ok: false, error: 'unavailable' }, 503)
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return reply({ ok: false, error: 'unauthorized' }, 401)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return reply({ ok: false, error: 'invalid' }, 400)

  let client = await fetchClientByEmail(user.email)
  if (!client.ok && client.error === 'not_found') {
    // HQ has not heard of this client yet (an earlier sync failed): send it now, then look again.
    const profile = await loadProfile(supabase, user)
    if (profile) await syncClientToHq(user.id, profile)
    client = await fetchClientByEmail(user.email)
  }
  if (!client.ok) return reply({ ok: false, error: client.error }, client.error === 'not_found' ? 404 : 502)

  const ticket = await createClientTicket(client.data.client.id, parsed.data.text)
  if (!ticket.ok) return reply({ ok: false, error: ticket.error }, 502)
  return reply({ ok: true, item: ticket.data })
}
