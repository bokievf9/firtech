import { NextResponse, type NextRequest } from 'next/server'
import { pickLocale } from '@/lib/i18n'
import { updateSession } from '@/lib/supabase/middleware'

// "/" sends visitors to their language; every other page already carries /ru or /en.
// Cabinet routes (/ru/cabinet/..., /en/cabinet/...) get their Supabase session refreshed here.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') return updateSession(request)
  const locale = pickLocale(request.headers.get('accept-language'))
  return NextResponse.redirect(new URL(`/${locale}`, request.url))
}

export const config = { matcher: ['/', '/(ru|en)/cabinet', '/(ru|en)/cabinet/:path*'] }
