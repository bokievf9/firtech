import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { chatRequestSchema } from '@/lib/chat'
import { askReceptionist, chatLimited, chatMode } from '@/lib/chat-hq'

// Public chat with the AI receptionist (widget: src/components/chat/). Validates and strips the
// message, limits each IP to 30 messages an hour, and forwards to HQ (or the dev mock). The
// visitor's text is never logged.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    'local'
  if (chatLimited(ip.trim())) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  const answer = await askReceptionist(parsed.data)
  if (!answer.ok) console.error(`[chat] receptionist unavailable: ${answer.error}`)
  return NextResponse.json(answer, {
    status: answer.ok ? 200 : answer.error === 'rate_limited' ? 429 : 502,
    // The widget shows «Демо-режим» when the scripted mock answered.
    headers: { 'cache-control': 'no-store', 'x-chat-mode': chatMode(process.env) },
  })
}
