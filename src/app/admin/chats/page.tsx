import { ChatsPage } from '@/components/admin/chats/chats-page'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Чаты' }

// Чаты с клиентами: threads and owner replies through /api/admin/hq/chats; the page checks the session.
export default async function Page() {
  await requireAdmin()
  return <ChatsPage />
}
