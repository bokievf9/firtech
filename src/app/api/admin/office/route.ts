import 'server-only'
import { guard } from '@/lib/admin-guard'
import { json } from '@/lib/admin-json'
import { fetchAdminOffice } from '@/lib/office-hq'

// Live office: proxies HQ's office JSON to the admin page (the admin variant with real task
// titles; the public one masks client data). Session-checked like every /api/admin route; the HQ
// token stays on the server. Failures come back as { ok: false, error } (HTTP 200, so the page can
// keep showing its last data); only a missing session is a 401.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  return json(await fetchAdminOffice())
}
