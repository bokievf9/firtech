import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { buildSignaturePayload } from '@/lib/cabinet-docs'
import { signClientDocument } from '@/lib/cabinet-hq'
import { visitorIp } from '@/lib/public-post'

// POST /api/cabinet/documents/<id>/sign { signaturePng, name, consent: true }: the simple electronic
// signature (owner 2026-11-22: drawn with the mouse, no code). The PNG data URL (<= 200 KB), the name
// and the consent are checked again here; the signer's IP and browser are added on the server (never
// taken from the body) and HQ stores the signature with the hash of the unsigned PDF.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/documents/[id]/sign'>) {
  const { id } = await ctx.params
  if (!safeToken(id)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const body = (await request.json().catch(() => null)) as { signaturePng?: unknown; name?: unknown; consent?: unknown } | null
  const built = buildSignaturePayload({ png: body?.signaturePng, name: body?.name, consent: body?.consent })
  if (!built.ok) return reply({ ok: false, error: built.error }, built.error === 'too_big' ? 413 : 422)
  const done = await signClientDocument(who.clientId, id, built.payload, {
    ip: visitorIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  })
  return done.ok ? reply({ ok: true }) : hqFailure(done.error)
}
