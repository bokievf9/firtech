import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
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

async function handle(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return apiError(rejected.error, rejected.status)
  const ip = visitorIp(request.headers)
  if (chatLimited(ip)) {
    return apiError('rate_limited', 429)
  }
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError('invalid', 400)
  }
  // Anyone may chat; a lead needs an account (owner 2026-11-20). A contact sent while signed out is
  // not forwarded (HQ would turn it into a lead): the widget asks to sign in instead.
  const user = cabinetEnabled() ? await peekLeadUser().catch(() => null) : null
  const gate = await leadGate(async () => user)
  // The #demo tabs (a persona is set) are for signed-in clients only (owner 2026-11-23, item 15: we must know
  // who spends what). The demo never creates a lead: a contact is answered here and not forwarded; the
  // identity goes to HQ as `clientId` / `clientEmail` / `demo: true` for the usage count.
  if (parsed.data.persona) {
    if (!gate.ok) return apiError('auth_required', 401, { 'x-chat-mode': chatMode(process.env) })
    if (wouldCreateLead(parsed.data.message)) {
      return NextResponse.json(
        { ok: true, reply: getDict(parsed.data.locale).demoSection.receptionist.noContacts, state: 'chat', demo: true },
        { headers: { 'cache-control': 'no-store', 'x-chat-mode': chatMode(process.env) } },
      )
    }
  }
  if (!gate.ok && wouldCreateLead(parsed.data.message)) {
    return NextResponse.json(
      { ok: true, reply: getDict(parsed.data.locale).chat.signInFirst, state: 'contact', authRequired: true },
      { headers: { 'cache-control': 'no-store', 'x-chat-mode': chatMode(process.env) } },
    )
  }
  const identity = gate.ok ? gate.identity : null
  const answer = await askReceptionist(parsed.data, process.env, fetch, ip, identity)
  if (!answer.ok) {
    if (answer.error !== 'demo_limit') console.error(`[chat] receptionist unavailable: ${answer.error}`)
    return apiError(answer.error, answer.error === 'auth_required' ? 401 : answer.error === 'rate_limited' || answer.error === 'demo_limit' ? 429 : answer.error === 'hq_timeout' ? 504 : 502, {
      'x-chat-mode': chatMode(process.env),
    })
  }
  return NextResponse.json(answer, {
    status: 200,
    // The widget shows «Демо-режим» when the scripted mock answered.
    headers: { 'cache-control': 'no-store', 'x-chat-mode': chatMode(process.env) },
  })
}

// Anything unexpected becomes a JSON error with a status, never an empty 500 page.
export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (error) {
    console.error('[chat] unexpected failure', error instanceof Error ? error.message : 'unknown')
    return apiError('server_error', 500)
  }
}
