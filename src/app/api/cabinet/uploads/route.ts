import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { UPLOAD_MAX_BYTES, checkUpload, isMaterialLabel } from '@/lib/cabinet-chat'
import { uploadThreadFile } from '@/lib/cabinet-hq'

// POST /api/cabinet/uploads (multipart: file, threadId, label?): a file for a thread, forwarded to HQ
// (`POST /admin/clients/:id/uploads` with the file as base64 JSON, then the id is attached to a message of the thread). Images, PDF, DOCX, ZIP and plain text up to 10 MB; the type is decided by the
// extension and checked again here, HQ checks it too. The answer is the new client message.
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const who = await cabinetCaller(request, { post: true, json: false })
  if (!who.ok) return who.response
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > UPLOAD_MAX_BYTES + 256 * 1024) return reply({ ok: false, error: 'too_large' }, 413)
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const threadId = String(form?.get('threadId') ?? '')
  const label = String(form?.get('label') ?? '')
  if (!(file instanceof File) || !safeToken(threadId) || (label && !isMaterialLabel(label))) return reply({ ok: false, error: 'invalid' }, 400)
  const checked = checkUpload(file)
  if (!checked.ok) return reply({ ok: false, error: checked.error === 'size' ? 'too_large' : 'invalid_type' }, checked.error === 'size' ? 413 : 415)
  const sent = await uploadThreadFile(who.clientId, threadId, file, label)
  return sent.ok ? reply({ ok: true, item: sent.data }) : hqFailure(sent.error)
}
