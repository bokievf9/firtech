import { ApprovalsPage } from '@/components/admin/approvals/approvals-page'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Approvals' }

// Approvals: Documents / Replies / Content / Money on top of the review centre's data. The page only
// checks the session; data and decisions go through the whitelist proxy /api/admin/hq/review.
export default async function Page({ searchParams }: PageProps<'/admin/approvals'>) {
  await requireAdmin()
  const tab = (await searchParams).tab
  return <ApprovalsPage initialTab={tab === 'replies' || tab === 'content' || tab === 'money' ? tab : 'documents'} />
}
