import { httpsUrl, idStr, intOrNull, isObj, list, str, strOrNull, unwrapList } from './cabinet-parse'

// Cabinet v3 (2026-11-22): the client's documents (КП, договор, счёт, акт), the e-signature payload
// and the «next action» of a project or request. Contract draft: `GET /admin/clients/:id/documents`,
// `.../documents/:docId/accept`, `.../sign` (HQ side: agents/docs/admin-crm-api.md, «Кабинет v3»).
// Pure: no network, no secrets, so tests import it directly.

export type DocKind = 'quote' | 'contract' | 'invoice' | 'act' | 'other'
export type DocState = 'awaiting_client' | 'accepted' | 'awaiting_signature' | 'signed' | 'issued' | 'paid' | 'void'

export const docKinds: DocKind[] = ['quote', 'contract', 'invoice', 'act', 'other']
export const docStates: DocState[] = ['awaiting_client', 'accepted', 'awaiting_signature', 'signed', 'issued', 'paid', 'void']

// A document as the SERVER holds it: `pdfUrl` is HQ's signed link (7 days) and never leaves
// the server (the browser gets `PublicDoc` and fetches the file through the session-checked proxy).
export type ClientDoc = {
  id: string
  kind: DocKind
  title: string
  number: string | null
  leadId: number | null
  projectId: number | null
  state: DocState
  createdAt: string | null
  deliveredAt: string | null
  acceptedAt: string | null
  signedAt: string | null
  pdfUrl: string | null
  amountUsd: number | null
  stageNo: number | null
  payUrl: string | null
}
export type PublicDoc = Omit<ClientDoc, 'pdfUrl'> & { hasPdf: boolean }

// A file link from HQ: https, or a path on HQ's own host (`/media/...`, resolved by the proxy).
const fileUrl = (v: unknown) =>
  typeof v === 'string' && v.length <= 1000 && (/^https:\/\/[^\s]+$/.test(v) || /^\/media\/[^\s]+$/.test(v)) ? v : null

export function parseClientDoc(r: Record<string, unknown>): ClientDoc | null {
  const id = idStr(r.id)
  if (id === null) return null
  const state = docStates.find((s) => s === r.state)
  if (!state) return null
  const kind = docKinds.find((k) => k === r.kind) ?? 'other'
  const amount = typeof r.amountUsd === 'number' && Number.isFinite(r.amountUsd) && r.amountUsd >= 0 ? r.amountUsd : null
  return {
    id,
    kind,
    title: str(r.title, 200),
    number: typeof r.number === 'string' && r.number ? r.number.slice(0, 40) : null,
    leadId: intOrNull(r.leadId),
    projectId: intOrNull(r.projectId),
    state,
    createdAt: strOrNull(r.createdAt),
    deliveredAt: strOrNull(r.deliveredAt),
    acceptedAt: strOrNull(r.acceptedAt),
    signedAt: strOrNull(r.signedAt),
    pdfUrl: fileUrl(r.pdfUrl),
    amountUsd: amount,
    stageNo: intOrNull(r.stageNo),
    payUrl: state === 'issued' ? httpsUrl(r.payUrl) : null,
  }
}

// `GET .../documents`: a bare array or a wrapped one; void documents are not shown to the client.
export function parseClientDocs(body: unknown): ClientDoc[] {
  const rows = unwrapList(body, ['documents'])
  return rows ? list(rows, parseClientDoc).filter((d) => d.state !== 'void') : []
}

export const publicDoc = (d: ClientDoc): PublicDoc => {
  const { pdfUrl, ...rest } = d
  return { ...rest, hasPdf: pdfUrl !== null }
}

// The client has to do something with this document: read and accept it, sign it, pay it.
// The label key of a state: the estimate and the act are «issued» in HQ but are only received, not billed.
export const docStateKey = (d: Pick<ClientDoc, 'kind' | 'state'>): DocState | 'delivered' =>
  d.state === 'issued' && d.kind !== 'invoice' ? 'delivered' : d.state

export const docNeedsClient = (d: Pick<ClientDoc, 'kind' | 'state'>) =>
  d.state === 'awaiting_client' || d.state === 'awaiting_signature' || (d.kind === 'invoice' && d.state === 'issued')

export type DocAction = 'accept' | 'sign' | 'pay' | 'download'

// The buttons of a document, from its kind and state. Paying needs a link; downloading needs a file.
export function docActions(d: Pick<PublicDoc, 'kind' | 'state' | 'payUrl' | 'hasPdf'>): DocAction[] {
  const out: DocAction[] = []
  if (d.kind === 'quote' && d.state === 'awaiting_client') out.push('accept')
  if (d.kind === 'contract' && d.state === 'awaiting_signature') out.push('sign')
  if (d.kind === 'invoice' && d.state === 'issued' && d.payUrl) out.push('pay')
  if (d.hasPdf) out.push('download')
  return out
}

// Needs-the-client first, then newest first.
export function sortDocs<T extends Pick<ClientDoc, 'kind' | 'state' | 'createdAt'>>(docs: readonly T[]): T[] {
  const time = (d: T) => (d.createdAt ? Date.parse(d.createdAt) || 0 : 0)
  return [...docs].sort((a, b) => Number(docNeedsClient(b)) - Number(docNeedsClient(a)) || time(b) - time(a))
}

export const docsNeedingClient = (docs: readonly Pick<ClientDoc, 'kind' | 'state'>[]) => docs.filter(docNeedsClient).length

// ---- e-signature ---------------------------------------------------------------------------------

export const SIGNATURE_MAX_BYTES = 200 * 1024
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export type SignatureError = 'no_signature' | 'bad_signature' | 'too_big' | 'name' | 'consent'

// Size in bytes of the decoded image and whether it starts like a PNG; the data URL must be PNG only.
export function checkSignaturePng(dataUrl: unknown): { ok: true; bytes: number } | { ok: false; error: SignatureError } {
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) return { ok: false, error: 'no_signature' }
  // Length first: a huge string never reaches the regex.
  if (dataUrl.length > Math.ceil((SIGNATURE_MAX_BYTES * 4) / 3) + 64) return { ok: false, error: 'too_big' }
  const match = PNG_DATA_URL.exec(dataUrl)
  if (!match) return { ok: false, error: 'bad_signature' }
  const b64 = match[1]!
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
  if (bytes > SIGNATURE_MAX_BYTES) return { ok: false, error: 'too_big' }
  const head = Buffer.from(b64.slice(0, 16), 'base64')
  if (!PNG_MAGIC.every((byte, i) => head[i] === byte)) return { ok: false, error: 'bad_signature' }
  return { ok: true, bytes }
}

export type SignaturePayload = { signaturePng: string; name: string; consent: true }

// What the browser sends to `POST /api/cabinet/documents/:id/sign` (and the server re-checks).
export function buildSignaturePayload(input: {
  png: unknown
  name: unknown
  consent: unknown
}): { ok: true; payload: SignaturePayload } | { ok: false; error: SignatureError } {
  const checked = checkSignaturePng(input.png)
  if (!checked.ok) return checked
  const name = typeof input.name === 'string' ? input.name.replace(/\s+/g, ' ').trim() : ''
  if (name.length < 2 || name.length > 120) return { ok: false, error: 'name' }
  if (input.consent !== true) return { ok: false, error: 'consent' }
  return { ok: true, payload: { signaturePng: input.png as string, name, consent: true } }
}

// The body HQ gets: the payload plus the signer's address and browser, added on the server.
export function signBodyForHq(payload: SignaturePayload, ip: string | undefined, userAgent: string | null | undefined) {
  return { ...payload, ip: ip && ip !== 'local' ? ip : '', userAgent: (userAgent ?? '').slice(0, 300) }
}

// ---- next action ---------------------------------------------------------------------------------

export type NextActionKind = 'accept_quote' | 'sign_contract' | 'pay_stage' | 'accept_stage' | 'wait'
export const nextActionKinds: NextActionKind[] = ['accept_quote', 'sign_contract', 'pay_stage', 'accept_stage', 'wait']

export type NextAction = {
  kind: NextActionKind
  docId: string | null
  stageNo: number | null
  payUrl: string | null
  // Optional sentence from HQ for `wait` («Ждём вас на созвоне 24 ноября»).
  text: string
}

// HQ's `nextAction` (also the object form of a lead's `nextStep`); null when it is not one.
export function parseNextAction(value: unknown): NextAction | null {
  if (!isObj(value)) return null
  const kind = nextActionKinds.find((k) => k === value.kind)
  if (!kind) return null
  return {
    kind,
    docId: idStr(value.docId),
    stageNo: intOrNull(value.stageNo),
    payUrl: httpsUrl(value.payUrl),
    text: str(value.text ?? value.label, 200),
  }
}

type MilestoneLike = { stageNo: number; state: string; payUrl: string | null }

// What to show when HQ sends no `nextAction` (an older HQ): derived from the documents and stages.
// `scope` narrows the documents to one project or request.
export function deriveNextAction(
  docs: readonly ClientDoc[],
  milestones: readonly MilestoneLike[] = [],
  scope: { projectId?: number; leadId?: number } = {},
): NextAction {
  const mine = docs.filter((d) => {
    if (scope.projectId !== undefined && d.projectId !== null) return d.projectId === scope.projectId
    if (scope.leadId !== undefined && d.leadId !== null) return d.leadId === scope.leadId
    return scope.projectId === undefined && scope.leadId === undefined
  })
  const base: NextAction = { kind: 'wait', docId: null, stageNo: null, payUrl: null, text: '' }
  const quote = mine.find((d) => d.kind === 'quote' && d.state === 'awaiting_client')
  if (quote) return { ...base, kind: 'accept_quote', docId: quote.id }
  const contract = mine.find((d) => d.kind === 'contract' && d.state === 'awaiting_signature')
  if (contract) return { ...base, kind: 'sign_contract', docId: contract.id }
  const accept = milestones.find((m) => m.state === 'awaiting_acceptance')
  if (accept) return { ...base, kind: 'accept_stage', stageNo: accept.stageNo }
  const invoice = mine.find((d) => d.kind === 'invoice' && d.state === 'issued')
  if (invoice) return { ...base, kind: 'pay_stage', docId: invoice.id, stageNo: invoice.stageNo, payUrl: invoice.payUrl }
  const pay = milestones.find((m) => m.state === 'awaiting_payment')
  if (pay) return { ...base, kind: 'pay_stage', stageNo: pay.stageNo, payUrl: pay.payUrl }
  return base
}

// HQ's action when it sent one, else the derived one.
export const resolveNextAction = (
  given: NextAction | null,
  docs: readonly ClientDoc[],
  milestones: readonly MilestoneLike[] = [],
  scope: { projectId?: number; leadId?: number } = {},
): NextAction => given ?? deriveNextAction(docs, milestones, scope)

// How the big button behaves: a link to the pay page, the document viewer in the «Документы» tab,
// the in-place stage acceptance, or nothing (the client only waits).
export type ActionControl =
  | { control: 'pay_link'; href: string }
  | { control: 'open_doc'; docId: string | null }
  | { control: 'accept_stage'; stageNo: number }
  | { control: 'none' }

export function actionControl(a: NextAction): ActionControl {
  if (a.kind === 'accept_quote' || a.kind === 'sign_contract') return { control: 'open_doc', docId: a.docId }
  if (a.kind === 'pay_stage') return a.payUrl ? { control: 'pay_link', href: a.payUrl } : { control: 'open_doc', docId: a.docId }
  if (a.kind === 'accept_stage') return a.stageNo !== null ? { control: 'accept_stage', stageNo: a.stageNo } : { control: 'none' }
  return { control: 'none' }
}

// The client has to act (every kind but `wait`, and an action that cannot be performed is not one).
export const actionNeedsClient = (a: NextAction) => actionControl(a).control !== 'none'

// A lead whose project already exists is hidden from the requests list: the documents link a
// `leadId` to a `projectId`, and the project card carries the status from then on.
export function leadsWithoutProject<L extends { id: number }>(
  leads: readonly L[],
  projects: readonly { id: number }[],
  docs: readonly Pick<ClientDoc, 'leadId' | 'projectId'>[],
): L[] {
  const projectIds = new Set(projects.map((p) => p.id))
  const taken = new Set(docs.filter((d) => d.leadId !== null && d.projectId !== null && projectIds.has(d.projectId)).map((d) => d.leadId))
  return leads.filter((l) => !taken.has(l.id))
}
