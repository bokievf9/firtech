import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { toAdminLead } from '@/lib/admin-data'
import { guard } from '@/lib/admin-guard'
import { bookingAction, setLeadStatus } from '@/lib/lead-bot'
import { getLead, leadStatuses, updateLead } from '@/lib/store'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status'), status: z.enum(leadStatuses) }),
  z.object({ action: z.literal('notes'), notes: z.string().max(4000) }),
  z.object({ action: z.literal('booking'), op: z.enum(['ok', 'move']) }),
])

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

// Panel changes to one lead. Status and booking go through the same code as the bot buttons, so the
// owner's Telegram message is edited too; notes stay on the site only.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guard(request)
  if (denied) return denied
  const id = Number((await context.params).id)
  if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'not_found' }, 404)
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ ok: false, error: 'invalid' }, 400)
  const input = parsed.data

  if (input.action === 'notes') {
    const lead = await updateLead(id, (l) => {
      l.notes = input.notes.trim() || undefined
    })
    if (!lead) return json({ ok: false, error: 'not_found' }, 404)
    return json({ ok: true, lead: toAdminLead(lead) })
  }

  if (!(await getLead(id))) return json({ ok: false, error: 'not_found' }, 404)
  try {
    const { lead, reply } =
      input.action === 'status'
        ? await setLeadStatus(id, input.status)
        : await bookingAction(id, input.op)
    if (!lead) return json({ ok: false, error: 'not_found' }, 404)
    return json({ ok: true, lead: toAdminLead(lead), reply })
  } catch (error) {
    // The store changed first; only the Telegram side failed. Report it and send the saved lead.
    console.error('[admin] telegram update failed', error)
    const lead = await getLead(id)
    return json({ ok: true, lead: lead && toAdminLead(lead), warning: 'telegram_failed' })
  }
}
