import { ReviewPage } from '@/components/admin/review/review-page'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ревью' }

// Ревью-центр: full-screen reading, editing and approving of everything the departments produced.
// Data comes from the whitelist proxy /api/admin/hq/review, so the page only checks the session.
export default async function Page({ searchParams }: PageProps<'/admin/review'>) {
  await requireAdmin()
  const id = (await searchParams).id
  return <ReviewPage initialId={typeof id === 'string' && /^ap_\d{1,12}$/.test(id) ? id : null} />
}
