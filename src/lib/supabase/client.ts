'use client'

import { createBrowserClient } from '@supabase/ssr'

// Browser client. Sign-in and sign-up go through server actions, so the cabinet does not need it
// today; it is here for client-side reads under RLS. NEXT_PUBLIC values are inlined at build time.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createBrowserClient(url, anonKey)
}
