import { NextResponse, type NextRequest } from 'next/server'
import { appOrigin } from '@/lib/cabinet-auth'
import { safeCabinetNext } from '@/lib/cabinet-data'
import { ensureHqSync, loadProfile } from '@/lib/cabinet-session'
import { isLocale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/server'

// Email confirmation, password reset and Google/Apple sign-in all come back here with `?code=`.
// The code becomes a session cookie; the client is then told to HQ once (best effort) and sent on.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: RouteContext<'/[locale]/cabinet/auth/callback'>) {
  const { locale } = await ctx.params
  const lang = isLocale(locale) ? locale : 'ru'
  const origin = appOrigin(request.headers)
  const login = (error: string) => NextResponse.redirect(`${origin}/${lang}/cabinet/login?error=${error}`)

  const code = request.nextUrl.searchParams.get('code')
  const supabase = await createClient()
  if (!supabase) return NextResponse.redirect(`${origin}/${lang}/cabinet`)
  if (!code) return login('callback')
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    // Diagnostics only: the error code and whether the PKCE verifier cookie reached us; no tokens.
    const hasVerifier = request.cookies.getAll().some((c) => c.name.endsWith('-code-verifier'))
    console.warn('[cabinet] code exchange failed', { code: error?.code ?? 'no_user', status: error?.status, hasVerifier })
    return login('callback')
  }

  try {
    const profile = await loadProfile(supabase, data.user)
    await ensureHqSync(supabase, data.user, profile)
  } catch {
    console.warn('[cabinet] callback sync failed')
  }
  const next = safeCabinetNext(request.nextUrl.searchParams.get('next'), lang)
  return NextResponse.redirect(`${origin}${next}`)
}
