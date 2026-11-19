import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseConfig } from './config'

// Per-request Supabase client for Server Components, Server Actions and Route Handlers. The
// session lives in cookies. Null when the cabinet is not configured.
export async function createClient() {
  const config = supabaseConfig()
  if (!config) return null
  const cookieStore = await cookies()
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component: cookies are read-only there. src/proxy.ts refreshes
          // the session on every cabinet request, so ignoring this is safe.
        }
      },
    },
  })
}
