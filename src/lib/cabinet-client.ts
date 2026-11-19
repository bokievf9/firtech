// Browser-side helpers of the cabinet that need no Supabase code. Pure, so tests import them.

// True when the browser holds a Supabase session cookie (`sb-<ref>-auth-token`, possibly chunked
// as `.0`, `.1`). Only for labels («Начать» or «Кабинет»): the server still checks the session.
// A PKCE verifier cookie (`...-auth-token-code-verifier`) is not a session.
export function hasSessionCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.\d+)?=[^;]/i.test(cookie)
}
