import 'server-only'
import { guard } from '@/lib/admin-guard'
import { json } from '@/lib/admin-json'
import { listIgDays, listIgItems } from '@/lib/instagram-store'

export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const [items, days] = await Promise.all([listIgItems(), listIgDays()])
  return json({ items, days })
}
