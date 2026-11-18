import { AdminShell } from '@/components/admin/admin-shell'
import { ControlCenter } from '@/components/admin/control/control-center'
import { admin } from '@/content/admin'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: admin.cc.title }

// Пульт (control center): the live office plus inbox, approvals, tasks, the Director chat and the
// drill. Every panel polls its own /api/admin/* proxy, so the page only checks the session.
export default async function OfficePage() {
  await requireAdmin()
  return (
    <AdminShell wide>
      <ControlCenter />
    </AdminShell>
  )
}
