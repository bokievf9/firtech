import { cabinetCaller, reply } from '@/lib/cabinet-api'
import { streamClientFile } from '@/lib/cabinet-media'

// GET /api/cabinet/media?u=<HQ link>&name=<file name>: an attachment of a message. Session-checked; only
// HQ's own `/media/` links are fetched (resolveMediaUrl), signed by HQ, so a link is not guessable.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const who = await cabinetCaller(request)
  if (!who.ok) return who.response
  const params = new URL(request.url).searchParams
  const u = params.get('u') ?? ''
  if (!u || u.length > 1000) return reply({ ok: false, error: 'invalid' }, 400)
  return streamClientFile(u, { download: params.get('download') === '1', name: params.get('name') ?? '' })
}
