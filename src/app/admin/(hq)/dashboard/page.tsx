import { DashboardSection } from '@/components/admin/dashboard/dashboard-section'

export const metadata = { title: 'Shell · Dashboard' }

// The Shell home: live numbers from HQ (`GET /admin/dashboard`). The layout of the (hq) group checks the session.
export default function Page() {
  return <DashboardSection />
}
