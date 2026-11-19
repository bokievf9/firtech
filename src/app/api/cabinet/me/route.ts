import { NextResponse } from 'next/server'
import { peekLeadUser } from '@/lib/lead-session'
import { cabinetEnabled } from '@/lib/supabase/config'

// GET /api/cabinet/me: who is signed in, for the lead forms (prefill the contact, skip the sign-in
// step). Only this visitor's own email, name and Telegram; never cached.
export const dynamic = 'force-dynamic'

const reply = (body: object) => NextResponse.json(body, { headers: { 'cache-control': 'private, no-store' } })

export async function GET() {
  if (!cabinetEnabled()) return reply({ enabled: false, signedIn: false })
  const user = await peekLeadUser().catch(() => null)
  if (!user) return reply({ enabled: true, signedIn: false })
  return reply({ enabled: true, signedIn: true, email: user.email, name: user.name, telegram: user.telegram })
}
