import { redirect } from 'next/navigation'

// Campaigns moved into Content as a tab (owner audit 2026-11-23).
export default function Page() {
  redirect('/admin/content?tab=campaigns')
}
