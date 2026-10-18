import 'server-only'
import { guard } from '@/lib/admin-guard'
import { invalid, json, notFound, readJson } from '@/lib/admin-json'
import { igPublishedSchema, setIgPublished } from '@/lib/instagram-store'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guard(request)
  if (denied) return denied
  const parsed = igPublishedSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid()
  const item = await setIgPublished((await context.params).id, parsed.data.published)
  return item ? json({ item }) : notFound()
}
