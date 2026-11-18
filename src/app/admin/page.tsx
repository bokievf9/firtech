import { redirect } from 'next/navigation'

// The owner panel is the control center only: /admin goes to /admin/office (which sends a visitor
// without a session on to the login screen).
export default function AdminIndexPage() {
  redirect('/admin/office')
}
