// Lead drafts across a sign-in (owner 2026-11-20): what the visitor typed is kept while they sign
// in or confirm their email, and put back when they return with `draft=1` in the address. Pure
// functions over a Storage-like object, so tests run them without a browser.
//
// Storage: localStorage (the confirmation link opens a new tab, where sessionStorage is empty),
// sessionStorage when localStorage throws. A draft lives 24 hours and is removed once sent.
export type DraftKind = 'lead' | 'audit' | 'estimate' | 'chat'
export type Draft = Record<string, string>
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const MAX_FIELDS = 20
const MAX_VALUE = 2000
// Never stored: the honeypot and anything that looks like a secret.
const SKIP = /^(website|password|token)$/i

const key = (kind: DraftKind) => `fir-draft-${kind}`

export function cleanDraft(data: Record<string, unknown>): Draft {
  const out: Draft = {}
  for (const [k, v] of Object.entries(data)) {
    if (Object.keys(out).length >= MAX_FIELDS) break
    if (typeof v !== 'string' || SKIP.test(k) || !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k)) continue
    out[k] = v.slice(0, MAX_VALUE)
  }
  return out
}

export function saveDraft(storage: StorageLike | null, kind: DraftKind, data: Record<string, unknown>, now = Date.now()) {
  if (!storage) return false
  try {
    storage.setItem(key(kind), JSON.stringify({ at: now, data: cleanDraft(data) }))
    return true
  } catch {
    return false
  }
}

export function loadDraft(storage: StorageLike | null, kind: DraftKind, now = Date.now()): Draft | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key(kind))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: unknown; data?: unknown }
    if (typeof parsed.at !== 'number' || now - parsed.at > DRAFT_TTL_MS || now < parsed.at - 60_000) {
      storage.removeItem(key(kind))
      return null
    }
    if (!parsed.data || typeof parsed.data !== 'object') return null
    const data = cleanDraft(parsed.data as Record<string, unknown>)
    return Object.keys(data).length ? data : null
  } catch {
    return null
  }
}

export function clearDraft(storage: StorageLike | null, kind: DraftKind) {
  try {
    storage?.removeItem(key(kind))
  } catch {
    // Nothing to do: the draft expires by itself.
  }
}

// The page to come back to after sign-in: the same path and query plus `draft=1`, same hash.
export function draftReturnPath(pathname: string, search: string, hash = ''): string {
  const params = new URLSearchParams(search)
  params.set('draft', '1')
  return `${pathname}?${params.toString()}${hash}`
}

export const hasDraftFlag = (search: string) => new URLSearchParams(search).get('draft') === '1'

// The address without `draft=1`, so a reload does not restore an already-sent draft again.
export function withoutDraftFlag(pathname: string, search: string, hash = ''): string {
  const params = new URLSearchParams(search)
  params.delete('draft')
  const q = params.toString()
  return `${pathname}${q ? `?${q}` : ''}${hash}`
}

export function draftStorage(win: { localStorage?: Storage; sessionStorage?: Storage } | undefined): StorageLike | null {
  if (!win) return null
  try {
    const probe = '__fir_draft_probe'
    win.localStorage?.setItem(probe, '1')
    win.localStorage?.removeItem(probe)
    if (win.localStorage) return win.localStorage
  } catch {
    // Private mode or blocked storage: fall through.
  }
  try {
    return win.sessionStorage ?? null
  } catch {
    return null
  }
}
