import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { streamClientFile } from '@/lib/cabinet-media'
import { fetchClientDocuments } from '@/lib/cabinet-hq'

// GET /api/cabinet/documents/<id>/file?format=pdf|html&download=1: the document's PDF (or HTML version)
// streamed from HQ after the session check and after finding the document in THIS client's list, so one
// client cannot open another's file by guessing an id. Iframe-able from this site only.
export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: RouteContext<'/api/cabinet/documents/[id]/file'>) {
  const { id } = await ctx.params
  if (!safeToken(id)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request)
  if (!who.ok) return who.response
  const params = new URL(request.url).searchParams
  const format = params.get('format') === 'html' ? 'html' : 'pdf'
  const docs = await fetchClientDocuments(who.clientId)
  if (!docs.ok) return hqFailure(docs.error)
  const doc = docs.data.find((d) => d.id === id)
  const url = doc ? (format === 'html' ? doc.htmlUrl : doc.pdfUrl) : null
  if (!doc || !url) return reply({ ok: false, error: 'not_found' }, 404)
  const base = [doc.number, doc.title].filter(Boolean).join(' ').slice(0, 80) || 'document'
  return streamClientFile(url, { download: params.get('download') === '1', name: `${base}.${format}` })
}
