import { HqShell } from '@/components/admin/hq/hq-shell'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'

// HQ: the CRM workplace of the owner panel (menu of sections, search, work area). Every page under
// this group checks the admin session here; the pixel office stays on /admin/office.
export default async function HqLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <HqShell>{children}</HqShell>
}
