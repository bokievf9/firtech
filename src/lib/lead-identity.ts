import { cabinetEnabled } from './supabase/config'

// Leads only from signed-in clients (owner 2026-11-20). Pure, so tests drive it with a fake user.
// While the cabinet is not configured (no Supabase env) the gate is open and leads work as before:
// a site without accounts must never lose a lead.
export type LeadUser = { id: string; email: string; name: string }
export type LeadIdentity = { clientEmail: string; cabinetId: string; clientName: string }
export type LeadGate =
  | { ok: true; identity: LeadIdentity | null }
  | { ok: false; status: 401; error: 'auth_required' }

export async function leadGate(
  getUser: () => Promise<LeadUser | null>,
  env: Record<string, string | undefined> = process.env,
): Promise<LeadGate> {
  if (!cabinetEnabled(env)) return { ok: true, identity: null }
  const user = await getUser().catch(() => null)
  const email = user?.email?.trim().toLowerCase() ?? ''
  if (!user || !email || !/^[A-Za-z0-9_-]{1,64}$/.test(user.id)) return { ok: false, status: 401, error: 'auth_required' }
  return {
    ok: true,
    identity: { clientEmail: email.slice(0, 200), cabinetId: user.id, clientName: (user.name ?? '').trim().slice(0, 80) },
  }
}

// The fields HQ receives with a lead, an audit or a chat message; nothing without an account.
export function identityFields(identity: LeadIdentity | null): Partial<LeadIdentity> {
  return identity ? { ...identity } : {}
}

// Where the browser goes after a lead: the cabinet with this lead open (`new` without an HQ id).
// `follow` keeps the Telegram «следить за заявкой» link of the site's own lead store.
export function cabinetLeadPath(locale: string, id: unknown, follow?: { id?: number; token?: string }): string {
  const clean = typeof id === 'number' && Number.isInteger(id) && id > 0 ? String(id) : typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : 'new'
  const params = new URLSearchParams({ lead: clean })
  if (follow?.id && follow.token && /^[a-f0-9]{6,64}$/.test(follow.token)) params.set('follow', `${follow.id}.${follow.token}`)
  return `/${locale === 'en' ? 'en' : 'ru'}/cabinet?${params.toString()}`
}
