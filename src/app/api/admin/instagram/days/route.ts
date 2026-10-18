import 'server-only'
import { guard } from '@/lib/admin-guard'
import { invalid, json, readJson } from '@/lib/admin-json'
import { igDaySchema, setIgDay } from '@/lib/instagram-store'

export async function PUT(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const parsed = igDaySchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid()
  return json({ day: await setIgDay(parsed.data) })
}
