import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { checkPublicPost, visitorIp } from '@/lib/public-post'
import { getDict } from '@/content'
import { chatRequestSchema, wouldCreateLead } from '@/lib/chat'
import { askReceptionist, chatLimited, chatMode } from '@/lib/chat-hq'
import { leadGate } from '@/lib/lead-identity'
import { peekLeadUser } from '@/lib/lead-session'
import { cabinetEnabled } from '@/lib/supabase/config'

// Public chat with the AI receptionist (widget: src/components/chat/). Validates and strips the
// message, limits each IP to 30 messages an hour, and forwards to HQ (or the dev mock). The
// visitor's text is never logged.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return NextResponse.json({ ok: false, error: rejected.error }, { status: rejected.status })
  const ip = visitorIp(request.headers)
  if (chatLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  // Anyone may chat; a lead needs an account (owner 2026-11-20). A contact sent while signed out is
  // not forwarded (HQ would turn it into a lead): the widget asks to sign in instead.
  const user = cabinetEnabled() ? await peekLeadUser().catch(() => null) : null
  const gate = await leadGate(async () => user)
  if (!gate.ok && wouldCreateLead(parsed.data.message)) {
    return NextResponse.json(
      { ok: true, reply: getDict(parsed.data.locale).chat.signInFirst, state: 'contact', authRequired: true },
      { headers: { 'cache-control': 'no-store', 'x-chat-mode': chatMode(process.env) } },
    )
  }
  const answer = await askReceptionist(parsed.data, process.env, fetch, ip, gate.ok ? gate.identity : null)
  if (!answer.ok) console.error(`[chat] receptionist unavailable: ${answer.error}`)
  return NextResponse.json(answer, {
    status: answer.ok ? 200 : answer.error === 'rate_limited' ? 429 : 502,
    // The widget shows «Демо-режим» when the scripted mock answered.
    headers: { 'cache-control': 'no-store', 'x-chat-mode': chatMode(process.env) },
  })
}
