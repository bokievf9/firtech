// PKCE verifier cookies (`<storage-key>-code-verifier`, one per sign-in attempt when
// `appendPkceFlowIdToRedirects` is on). Nothing in @supabase/ssr removes them, so they piled up
// and pushed the callback's response headers over nginx's proxy buffer (2026-11-21, 502).
// Pure helpers, so tests import them.
export const VERIFIER_SUFFIX = '-code-verifier'

export function cookieNamesFromHeader(header: string): string[] {
  const names: string[] = []
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    const name = (eq === -1 ? part : part.slice(0, eq)).trim()
    if (name) names.push(name)
  }
  return names
}

export const isVerifierCookie = (name: string) => name.endsWith(VERIFIER_SUFFIX)

// Verifier cookie names present in `names` that are not in `keep` (the ones just written).
export function staleVerifierNames(names: Iterable<string>, keep: Iterable<string> = []): string[] {
  const kept = new Set(keep)
  return [...new Set(names)].filter((n) => isVerifierCookie(n) && !kept.has(n))
}

// Browser: expire every verifier cookie (path `/`, same flags as config.ts). Never throws.
export function clearVerifierCookies(doc: { cookie: string } | undefined = typeof document === 'undefined' ? undefined : document): number {
  if (!doc) return 0
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
    const names = staleVerifierNames(cookieNamesFromHeader(doc.cookie))
    for (const n of names) doc.cookie = `${n}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    return names.length
  } catch {
    return 0
  }
}
