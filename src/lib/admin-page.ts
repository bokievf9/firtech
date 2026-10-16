import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isValidSession, SESSION_COOKIE } from './admin-auth'

// Server-side session check for /admin pages: no valid session, straight to the login screen.
export async function hasAdminSession() {
  return isValidSession((await cookies()).get(SESSION_COOKIE)?.value)
}

// Returns the request time, so the pages compute "today" and "overdue" from one clock reading.
export async function requireAdmin() {
  if (!(await hasAdminSession())) redirect('/admin/login')
  return Date.now()
}
