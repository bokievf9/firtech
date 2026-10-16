import 'server-only'
import { admin } from '@/content/admin'
import { dayKey, leadsCsv, toAdminLead } from '@/lib/admin-data'
import { guard } from '@/lib/admin-guard'
import { allLeads } from '@/lib/store'

// "Скачать CSV": every lead, newest first, UTF-8 with BOM so Excel shows Cyrillic.
export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const leads = (await allLeads()).map(toAdminLead).reverse()
  const csv = leadsCsv(leads, {
    statuses: admin.statuses,
    services: admin.services,
    bookings: admin.bookings,
    header: admin.csvHeader,
  })
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="firtech-leads-${dayKey(Date.now())}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
