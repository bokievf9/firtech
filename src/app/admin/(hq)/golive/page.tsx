import { GolivePage } from '@/components/admin/golive/golive-page'
import { goliveText } from '@/content/golive'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: `Shell · ${goliveText.title}` }

// Go-live stage: a countdown over a shader field with the checklist below, inside the Shell frame. The data
// comes from /api/admin/golive, so the page only checks the session (like /admin/office).
export default async function GoLivePage() {
  await requireAdmin()
  return <GolivePage />
}
