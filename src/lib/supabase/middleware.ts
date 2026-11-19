import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { serverCookieOptions, supabaseConfig } from './config'

// Refreshes the Supabase session cookies for a request (called from src/proxy.ts on cabinet
// routes). Redirecting signed-out visitors is done by the pages, which know the locale.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const config = supabaseConfig()
  if (!config) return response
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: serverCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
      },
    },
  })
  // Reading the user is what refreshes an expired token.
  await supabase.auth.getUser()
  return response
}
