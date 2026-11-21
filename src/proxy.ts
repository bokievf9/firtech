import { NextResponse, type NextRequest } from 'next/server'
import { isAuthCallbackPath } from '@/lib/cabinet-auth'
import { isBareLocalePath, pickLocale } from '@/lib/i18n'
import { updateSession } from '@/lib/supabase/middleware'

// "/" sends visitors to their language; so does a bare path of a known page (`/terms`, `/privacy`,
// `/services/websites`...: contracts and offers link them without a language), keeping the rest of
// the path and the query. Every other page already carries /ru or /en.
// Cabinet routes (/ru/cabinet/..., /en/cabinet/...) get their Supabase session refreshed here,
// except the auth callback: it must see the PKCE verifier cookie exactly as the browser sent it,
// so nothing here reads, refreshes or rewrites cookies on that path. Every cabinet answer is
// `private, no-store`, so no cache can hand one visitor's login page (or session) to another.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/') {
    const locale = pickLocale(request.headers.get('accept-language'))
    return NextResponse.redirect(new URL(`/${locale}`, request.url))
  }
  if (isBareLocalePath(pathname)) {
    const locale = pickLocale(request.headers.get('accept-language'))
    return NextResponse.redirect(new URL(`/${locale}${pathname}${request.nextUrl.search}`, request.url))
  }
  const response = isAuthCallbackPath(pathname) ? NextResponse.next() : await updateSession(request)
  response.headers.set('cache-control', 'private, no-store')
  return response
}

export const config = {
  matcher: [
    '/',
    '/(terms|privacy|pay-how|compare|referral|audit|status|builder|blog|ai-team|cabinet|solutions|services|how-we-work|products)/:path*',
    '/(ru|en)/cabinet',
    '/(ru|en)/cabinet/:path*',
  ],
}
