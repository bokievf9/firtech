import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { appOrigin, authErrorKey, authLogFields, callbackFailureKey, safeNextPath } from '@/lib/cabinet-auth'
import { syncAfterSignIn } from '@/lib/cabinet-session'
import { isLocale } from '@/lib/i18n'
import { visitorIp } from '@/lib/public-post'
import { serverCookieOptions, supabaseConfig } from '@/lib/supabase/config'

// Email confirmation, password reset and Google sign-in all come back here.
// - `?code=` (PKCE): exchanged with the verifier cookie the browser sent. The flow id Supabase adds
//   (`sb_flow_id`) picks the exact verifier slot, so a second sign-in started in another tab can
//   never lend its verifier to this code.
// - `?token_hash=&type=` (email template with {{ .TokenHash }}): verified without any verifier, so
//   a confirmation link works in any browser or device.
// Cookies are buffered and written only onto the answer of a successful exchange: a failed attempt
// never deletes the verifier, so the browser retry (/cabinet/auth/confirm) still has it.
// The proxy does not touch this path. Logs carry codes and booleans, never tokens.
export const dynamic = 'force-dynamic'

type Pending = { name: string; value: string; options: Record<string, unknown> }
const otpTypes = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change'] as const

export async function GET(request: NextRequest, ctx: RouteContext<'/[locale]/cabinet/auth/callback'>) {
  const { locale } = await ctx.params
  const lang = isLocale(locale) ? locale : 'ru'
  const origin = appOrigin(request.headers)
  const params = request.nextUrl.searchParams
  const flow = params.get('flow')
  const next = safeNextPath(params.get('next'), lang)
  const login = (error: string) => noStore(NextResponse.redirect(`${origin}/${lang}/cabinet/login?error=${error}`))

  const config = supabaseConfig()
  if (!config) return noStore(NextResponse.redirect(`${origin}/${lang}/cabinet`))

  // Google or Supabase reported a failure (the visitor pressed «Cancel», a provider error).
  const providerError = params.get('error_code') || params.get('error')
  if (providerError) {
    console.warn('[cabinet] callback provider error', authLogFields('provider', { code: providerError }))
    return login(callbackFailureKey(providerError, flow))
  }

  const pending: Pending[] = []
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: serverCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) pending.push({ name: c.name, value: c.value, options: c.options as Record<string, unknown> })
      },
    },
  })
  const succeed = async (user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>) => {
    await syncAfterSignIn(supabase, user, lang, visitorIp(request.headers))
    const res = NextResponse.redirect(`${origin}${next}`)
    for (const c of pending) res.cookies.set(c.name, c.value, c.options)
    return noStore(res)
  }

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const flowId = params.get('sb_flow_id')
  const verifierCookies = request.cookies.getAll().filter((c) => c.name.endsWith('-code-verifier')).length
  console.info('[cabinet] callback', {
    kind: code ? 'code' : tokenHash ? 'token_hash' : 'none',
    flow: flow ?? '',
    hasFlowId: Boolean(flowId),
    verifierCookies,
    ua: request.headers.get('user-agent')?.slice(0, 60),
  })

  if (tokenHash && (otpTypes as readonly string[]).includes(type ?? '')) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
    if (!error && data.user) return succeed(data.user)
    console.warn('[cabinet] token verification failed', authLogFields('verify', error))
    return login(callbackFailureKey(error?.code, flow))
  }
  if (!code) return login('callback')

  const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
  if (!error && data.user) return succeed(data.user)

  // A code can be exchanged once. When the same callback is requested twice (prefetch, a retry),
  // the first exchange already set the session cookies: let a signed-in visitor through.
  const existing = await supabase.auth.getUser()
  if (existing.data.user) {
    console.info('[cabinet] callback repeated, session present')
    return succeed(existing.data.user)
  }
  console.warn('[cabinet] code exchange failed', { ...authLogFields('exchange', error), hasFlowId: Boolean(flowId), verifierCookies })
  const key = callbackFailureKey(error?.code, flow)
  // An expired link or a cancelled sign-in cannot be helped by a retry; the rest get one more try
  // in the browser, which reads its own verifier cookie (see confirm/page.tsx).
  if (key === 'link_expired' || key === 'oauth_cancelled' || authErrorKey(error ?? undefined) === 'network') return login(key)
  const retry = new URLSearchParams({ code, next, reason: key })
  if (flowId) retry.set('sb_flow_id', flowId)
  if (flow) retry.set('flow', flow)
  return noStore(NextResponse.redirect(`${origin}/${lang}/cabinet/auth/confirm?${retry.toString()}`))
}

function noStore(res: NextResponse) {
  res.headers.set('cache-control', 'private, no-store')
  return res
}
