// «Client from owner» (Shell, Clients > Pipeline): the owner hands HQ a client he found himself. Pure helpers for the dialog:
// the form -> body (the proxy `leads/owner` is strict, see `hq-admin.ts`), field errors as keys, the answer check.

export const OWNER_LIMITS = { name: 200, contact: 200, need: 4000, links: 10, link: 2000 } as const
export const OWNER_SOURCE = 'owner'

export type OwnerForm = { name: string; contact: string; need: string; links: string }
export type OwnerErrors = Partial<Record<'name' | 'need' | 'contact' | 'links', 'required' | 'tooLong' | 'tooMany' | 'badLink'>>
export type OwnerBody = { name: string; contact?: string; need: string; links?: string[]; clientRef: string }

// One link per line; blanks dropped, duplicates removed.
export function parseLinks(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))]
}

const isHttp = (v: string) => v.length <= OWNER_LIMITS.link && /^https?:\/\/[^\s]+$/i.test(v)

export function ownerErrors(form: OwnerForm): OwnerErrors {
  const out: OwnerErrors = {}
  const name = form.name.trim()
  const need = form.need.trim()
  if (!name) out.name = 'required'
  else if (name.length > OWNER_LIMITS.name) out.name = 'tooLong'
  if (!need) out.need = 'required'
  else if (need.length > OWNER_LIMITS.need) out.need = 'tooLong'
  if (form.contact.trim().length > OWNER_LIMITS.contact) out.contact = 'tooLong'
  const links = parseLinks(form.links)
  if (links.length > OWNER_LIMITS.links) out.links = 'tooMany'
  else if (links.some((l) => !isHttp(l))) out.links = 'badLink'
  return out
}

export function ownerBody(form: OwnerForm, clientRef: string): OwnerBody {
  const contact = form.contact.trim()
  const links = parseLinks(form.links)
  return {
    name: form.name.trim(),
    ...(contact ? { contact } : {}),
    need: form.need.trim(),
    ...(links.length ? { links } : {}),
    clientRef: clientRef.slice(0, 64),
  }
}

export function normalizeOwnerAnswer(body: unknown): { id: string; leadId: string } | null {
  if (!body || typeof body !== 'object') return null
  const r = body as Record<string, unknown>
  const id = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? String(v) : typeof v === 'string' && /^[\w:.-]{1,64}$/.test(v) ? v : null)
  const a = id(r.id)
  const b = id(r.leadId)
  return a !== null && b !== null ? { id: a, leadId: b } : null
}

// A lead from the owner without a contact: HQ delivers to the channel `owner`, so replies come to the owner to forward.
export const isOwnerLead = (l: { source: string }) => l.source === OWNER_SOURCE
export const ownerLeadNoContact = (l: { source: string; contact: string }) => isOwnerLead(l) && !l.contact.trim()
