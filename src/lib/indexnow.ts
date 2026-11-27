// IndexNow and search-engine verification helpers (SEO 2026-11-27).
// The key file `/<key>.txt` is served by the proxy rewriting to /api/indexnow-key, which answers the
// key only when the requested name equals INDEXNOW_KEY (32 hex characters), 404 otherwise.

const KEY_RE = /^[0-9a-f]{32}$/

export function validIndexNowKey(key: string | undefined | null): key is string {
  return typeof key === 'string' && KEY_RE.test(key)
}

// "/<32 hex>.txt" -> the 32 hex name, anything else -> null.
export function keyFromPath(pathname: string): string | null {
  const match = /^\/([0-9a-f]{32})\.txt$/.exec(pathname)
  return match?.[1] ?? null
}

// Next `verification` metadata: a tag renders only when its variable is set.
export function verificationFromEnv(env: Record<string, string | undefined> = process.env) {
  const google = env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
  const yandex = env.NEXT_PUBLIC_YANDEX_VERIFICATION?.trim()
  if (!google && !yandex) return undefined
  return { ...(google ? { google } : {}), ...(yandex ? { yandex } : {}) }
}
