import 'server-only'
import { NextResponse } from 'next/server'
import { toAdminLead } from '@/lib/admin-data'
import { guard } from '@/lib/admin-guard'
import { allLeads } from '@/lib/store'

// The site-form leads for the panels «Лиды» and «Созвоны» of the control center: newest last, as
// stored; the browser sorts. Bot internals are dropped by toAdminLead. Session-checked.
export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const leads = (await allLeads()).map(toAdminLead)
  return NextResponse.json(
    { ok: true, leads, now: Date.now() },
    { headers: { 'cache-control': 'no-store' } },
  )
}
