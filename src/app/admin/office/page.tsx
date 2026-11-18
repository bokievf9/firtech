import { AdminShell } from '@/components/admin/admin-shell'
import { OfficeBoard } from '@/components/admin/office/office-board'
import { admin } from '@/content/admin'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: admin.office.title }

// "Живой офис": the board polls /api/admin/office itself, so the page only checks the session.
export default async function OfficePage() {
  await requireAdmin()
  return (
    <AdminShell>
      <OfficeBoard />
    </AdminShell>
  )
}
