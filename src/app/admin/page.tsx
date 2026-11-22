import { redirect } from 'next/navigation'

// /admin opens the Dashboard, the home of the Shell; a visitor without a session goes on to the login screen from there.
// The Inbox is /admin/inbox, the pixel office /admin/office.
export default function AdminIndexPage() {
  redirect('/admin/dashboard')
}
