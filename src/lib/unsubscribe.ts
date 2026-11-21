import { createHmac, timingSafeEqual } from 'node:crypto'

// «Отписаться» links in letters (2026-11-22): `/<locale>/cabinet/unsubscribe?token=<token>` switches ONE
// setting off without signing in. Token = `<base64url(user id)>.<field>.<signature>`, signature =
// base64url(HMAC-SHA256(UNSUBSCRIBE_SECRET, "unsub:v1:<user id>:<field>")). No expiry: an old letter must
// still work. HQ builds the same token for the letters it sends (docs/cabinet.md «Нужно от HQ»).
export const UNSUB_FIELDS = ['marketing', 'recommendations'] as const
export type UnsubField = (typeof UNSUB_FIELDS)[number]
export const UNSUB_COLUMNS: Record<UnsubField, string> = {
  marketing: 'marketing_consent',
  recommendations: 'recommendations_consent',
}

const MIN_SECRET = 16

export function unsubscribeSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = env.UNSUBSCRIBE_SECRET?.trim()
  return s && s.length >= MIN_SECRET ? s : null
}

const sign = (secret: string, userId: string, field: UnsubField) =>
  createHmac('sha256', secret).update(`unsub:v1:${userId}:${field}`).digest('base64url')

export function unsubscribeToken(userId: string, field: UnsubField, secret: string): string {
  return `${Buffer.from(userId).toString('base64url')}.${field}.${sign(secret, userId, field)}`
}

export function verifyUnsubscribeToken(token: string | null | undefined, secret: string | null): { userId: string; field: UnsubField } | null {
  if (!secret || !token || token.length > 300) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [rawId, field, sig] = parts as [string, string, string]
  if (!(UNSUB_FIELDS as readonly string[]).includes(field)) return null
  let userId: string
  try {
    userId = Buffer.from(rawId, 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null
  const want = Buffer.from(sign(secret, userId, field as UnsubField))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  return { userId, field: field as UnsubField }
}

export function unsubscribeLink(origin: string, locale: 'ru' | 'en', token: string) {
  return `${origin.replace(/\/$/, '')}/${locale}/cabinet/unsubscribe?token=${encodeURIComponent(token)}`
}
