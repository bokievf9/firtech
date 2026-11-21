import { redirect } from 'next/navigation'

// /admin opens HQ (the Inbox); a visitor without a session goes on to the login screen from there.
// The pixel office lives on /admin/office.
export default function AdminIndexPage() {
  redirect('/admin/inbox')
}
