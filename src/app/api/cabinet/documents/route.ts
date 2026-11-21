import { cabinetCaller, hqFailure, reply } from '@/lib/cabinet-api'
import { publicDoc, sortDocs } from '@/lib/cabinet-docs'
import { fetchClientDocuments } from '@/lib/cabinet-hq'

// GET /api/cabinet/documents: the client's documents without HQ's file links (the browser opens files
// through /api/cabinet/documents/<id>/file), for refreshing the list after an accept or a signature.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const who = await cabinetCaller(request)
  if (!who.ok) return who.response
  const docs = await fetchClientDocuments(who.clientId)
  if (!docs.ok) return hqFailure(docs.error)
  return reply({ ok: true, documents: sortDocs(docs.data).map(publicDoc) })
}
