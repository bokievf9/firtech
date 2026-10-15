import { NextResponse, type NextRequest } from 'next/server'
import { pickLocale } from '@/lib/i18n'

// "/" sends visitors to their language; every other page already carries /ru or /en.
export function proxy(request: NextRequest) {
  const locale = pickLocale(request.headers.get('accept-language'))
  return NextResponse.redirect(new URL(`/${locale}`, request.url))
}

export const config = { matcher: ['/'] }
