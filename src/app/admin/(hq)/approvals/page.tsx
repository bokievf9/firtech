import { ApprovalsPage } from '@/components/admin/approvals/approvals-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shell · Approvals' }

// Approvals: Documents / Replies / Content / Money and the reader and editor, in the Shell frame. The Shell layout
// checks the session; data and decisions go through the whitelist proxy /api/admin/hq/review. `?tab=` and `?id=`
// are validated on the client (lib/approvals.ts `parseTab`, `parseItemId`).
export default function Page() {
  return <ApprovalsPage />
}
