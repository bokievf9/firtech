'use client'

import { createBrowserClient } from '@supabase/ssr'
import { authCookieOptions } from './config'

// Browser client (a singleton per tab). Google sign-in starts here, so the PKCE verifier is written
// by the same browser that comes back with the code; the callback page also retries the exchange
// with it. `detectSessionInUrl` is off: the code is exchanged explicitly, never twice by accident.
// NEXT_PUBLIC values are inlined at build time.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createBrowserClient(url, anonKey, {
    cookieOptions: authCookieOptions(typeof location !== 'undefined' && location.protocol === 'https:'),
    // The flow id rides in the redirect URL (`sb_flow_id`), so the callback picks this flow's own
    // verifier even when another sign-in was started in a second tab. Needs a wildcard Redirect URL
    // (`https://firtech.pro/**`) in Supabase, which the cabinet setup uses.
    auth: { detectSessionInUrl: false, experimental: { appendPkceFlowIdToRedirects: true } },
  })
}
