import { AdminShell } from '@/components/admin/admin-shell'
import { LeadsBoard } from '@/components/admin/leads-board'
import { toAdminLead } from '@/lib/admin-data'
import { requireAdmin } from '@/lib/admin-page'
import { allLeads } from '@/lib/store'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage({ searchParams }: PageProps<'/admin/leads'>) {
  const now = await requireAdmin()
  const { id } = await searchParams
  const leads = (await allLeads()).map(toAdminLead)
  const openId = Number(Array.isArray(id) ? id[0] : id) || null
  return (
    <AdminShell>
      <LeadsBoard initialLeads={leads} initialOpenId={openId} now={now} />
    </AdminShell>
  )
}
