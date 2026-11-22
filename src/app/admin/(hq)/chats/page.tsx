import { ChatsPage } from '@/components/admin/chats/chats-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shell · Chats' }

// Чаты с клиентами: threads and owner replies through /api/admin/hq/chats; the page checks the session.
export default function Page() {
  return <ChatsPage />
}
