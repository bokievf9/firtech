import { NextResponse } from 'next/server'
import { acceptMilestone, fetchClientByEmail } from '@/lib/cabinet-hq'
import { checkPublicPost } from '@/lib/public-post'
import { createClient } from '@/lib/supabase/server'

// POST /api/cabinet/projects/<pid>/milestones/<no>/accept: the client accepts a finished stage.
// The client is found in HQ by the session's email, never by anything the browser sends; HQ
// checks that the project is theirs (a foreign one is 404) and that the stage is paid and done
// (409 `not_paid` / `not_ready`, passed on as codes the cabinet turns into sentences).
export const dynamic = 'force-dynamic'

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/projects/[pid]/milestones/[no]/accept'>) {
  const bad = checkPublicPost(request)
  if (bad) return reply({ ok: false, error: bad.error }, bad.status)
  const { pid, no } = await ctx.params
  if (!/^\d{1,12}$/.test(pid) || !/^\d{1,3}$/.test(no)) return reply({ ok: false, error: 'invalid' }, 400)
  const supabase = await createClient()
  if (!supabase) return reply({ ok: false, error: 'unavailable' }, 503)
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) return reply({ ok: false, error: 'unauthorized' }, 401)

  const client = await fetchClientByEmail(data.user.email)
  if (!client.ok) return reply({ ok: false, error: client.error }, client.error === 'not_found' ? 404 : 502)
  const done = await acceptMilestone(client.data.client.id, Number(pid), Number(no))
  if (!done.ok) {
    const status = done.error === 'not_found' ? 404 : done.error === 'not_ready' || done.error === 'not_paid' ? 409 : 502
    return reply({ ok: false, error: done.error }, status)
  }
  return reply({ ok: true, already: done.data.already, milestone: done.data.milestone })
}
