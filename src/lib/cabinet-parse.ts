// Tolerant JSON readers shared by the cabinet parsers (cabinet-data, -docs, -chat, -agent). HQ is a
// separate service whose answers can change, so every field is checked and unknown shapes are dropped.

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '')
export const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 80) : null)
export const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
export const idNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const idStr = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)
export const intOrNull = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)
export const boolOrNull = (v: unknown) => (typeof v === 'boolean' ? v : null)
export const httpsUrl = (v: unknown, max = 500) => (typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) ? v.slice(0, max) : null)

// One list: items that do not look right are dropped, the rest are cleaned.
export function list<T>(value: unknown, parse: (row: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const row of value) {
    const item = isObj(row) ? parse(row) : null
    if (item) out.push(item)
  }
  return out
}

// HQ answers a collection either as a bare array or wrapped (`{ ok, items }`, `{ documents }`...).
export function unwrapList(body: unknown, keys: readonly string[]): unknown[] | null {
  if (Array.isArray(body)) return body
  if (!isObj(body)) return null
  for (const key of ['items', ...keys]) if (Array.isArray(body[key])) return body[key] as unknown[]
  return null
}
