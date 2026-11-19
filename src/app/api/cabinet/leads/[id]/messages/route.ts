import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchClientByEmail, postLeadMessage } from '@/lib/cabinet-hq'
import { checkPublicPost } from '@/lib/public-post'
import { createClient } from '@/lib/supabase/server'

// POST /api/cabinet/leads/<id>/messages { text }: the client writes about one of their requests.
// The client is found in HQ by the session's email, never by anything the browser sends; HQ
// checks that the request belongs to that client (a foreign one is 404).
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ text: z.string().trim().min(2).max(2000) })
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/leads/[id]/messages'>) {
  const bad = checkPublicPost(request)
  if (bad) return reply({ ok: false, error: bad.error }, bad.status)
  const { id } = await ctx.params
  if (!/^\d{1,12}$/.test(id)) return reply({ ok: false, error: 'invalid' }, 400)
  const supabase = await createClient()
  if (!supabase) return reply({ ok: false, error: 'unavailable' }, 503)
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) return reply({ ok: false, error: 'unauthorized' }, 401)
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return reply({ ok: false, error: 'invalid' }, 400)

  const client = await fetchClientByEmail(data.user.email)
  if (!client.ok) return reply({ ok: false, error: client.error }, client.error === 'not_found' ? 404 : 502)
  const sent = await postLeadMessage(client.data.client.id, Number(id), parsed.data.text)
  if (!sent.ok) {
    const status = sent.error === 'not_found' ? 404 : sent.error === 'rate_limited' ? 429 : 502
    return reply({ ok: false, error: sent.error }, status)
  }
  return reply({ ok: true, item: sent.data })
}
