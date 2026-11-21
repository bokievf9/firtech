import { z } from 'zod'
import { normalizeTelegram } from './cabinet-data'

// Validation and error mapping for the cabinet's sign-in forms. Pure, so tests import it.
export const authErrorKeys = [
  'invalid_credentials',
  'email_not_confirmed',
  'user_exists',
  'weak_password',
  'same_password',
  'rate_limit',
  'email_rate_limit',
  'email_unavailable',
  'invalid_email',
  'invalid_input',
  'callback',
  'link_expired',
  'other_browser',
  'confirmed_login',
  'session_expired',
  'oauth',
  'oauth_cancelled',
  'signup_disabled',
  'network',
  'mail_down',
  'server_error',
  'unavailable',
  'generic',
] as const
export type AuthErrorKey = (typeof authErrorKeys)[number]
export const isAuthErrorKey = (v: unknown): v is AuthErrorKey =>
  typeof v === 'string' && (authErrorKeys as readonly string[]).includes(v)

const email = z.string().trim().toLowerCase().max(200).pipe(z.email())
const password = z.string().min(8).max(72)

export const signInSchema = z.object({ email, password: z.string().min(1).max(72) })
export const signUpSchema = z.object({
  email,
  password,
  name: z.string().trim().max(80),
  telegram: z.string().trim().max(60),
  marketing: z.boolean(),
})
export const forgotSchema = z.object({ email })
export const resetSchema = z.object({ password })

// Which field failed, mapped to the message key the form shows.
export function validationKey(error: z.ZodError): AuthErrorKey {
  const field = error.issues[0]?.path[0]
  if (field === 'email') return 'invalid_email'
  if (field === 'password') return 'weak_password'
  return 'invalid_input'
}

export function signUpInput(form: FormData) {
  const telegram = normalizeTelegram(String(form.get('telegram') ?? ''))
  return {
    parsed: signUpSchema.safeParse({
      email: form.get('email') ?? '',
      password: form.get('password') ?? '',
      name: form.get('name') ?? '',
      telegram: telegram ?? '',
      marketing: form.get('marketing') === 'on',
    }),
    telegramOk: telegram !== null,
  }
}

// Supabase error codes (auth-js `error.code`) grouped by what the visitor can do about them.
const codeMap: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'user_exists',
  email_exists: 'user_exists',
  identity_already_exists: 'user_exists',
  weak_password: 'weak_password',
  same_password: 'same_password',
  over_email_send_rate_limit: 'email_rate_limit',
  over_request_rate_limit: 'rate_limit',
  over_sms_send_rate_limit: 'rate_limit',
  email_address_invalid: 'invalid_email',
  email_address_not_authorized: 'email_unavailable',
  validation_failed: 'invalid_input',
  signup_disabled: 'signup_disabled',
  email_provider_disabled: 'signup_disabled',
  provider_disabled: 'oauth',
  oauth_provider_not_supported: 'oauth',
  otp_expired: 'link_expired',
  otp_disabled: 'callback',
  flow_state_not_found: 'callback',
  flow_state_expired: 'link_expired',
  bad_code_verifier: 'callback',
  bad_oauth_state: 'callback',
  bad_oauth_callback: 'callback',
  pkce_code_verifier_not_found: 'other_browser',
  access_denied: 'oauth_cancelled',
  session_not_found: 'session_expired',
  session_expired: 'session_expired',
  refresh_token_not_found: 'session_expired',
  refresh_token_already_used: 'session_expired',
  user_banned: 'generic',
}

// Maps a Supabase auth error to a key the dictionary has. Unknown errors are `generic`; nothing
// from the error text reaches the visitor (the raw code goes to the server log only).
//
// 5xx (2026-11-22): auth-js raises `AuthRetryableFetchError` both when fetch itself fails (status 0, a real
// network problem) and on 502/503/504 from Supabase Auth, and `AuthApiError` with `unexpected_failure` on a
// 500 such as «Error sending confirmation email» (Supabase's SMTP broken). The owner saw «нет связи» with a
// working internet. Now: status 0 = `network`; a 5xx about sending mail = `mail_down`; any other 5xx =
// `server_error` (its text carries the support code AUTH-5XX). Each 5xx is logged as
// `[cabinet] auth 5xx <status> <code>` (no address, no message text).
const MAIL_FAILURE = /error sending .*e-?mail|sending (confirmation|recovery|magic link|invite|email change) e-?mail|smtp/i

export function authErrorKey(
  error: { code?: string; status?: number; message?: string; name?: string } | null | undefined,
): AuthErrorKey {
  if (!error) return 'generic'
  const code = error.code ?? ''
  const status = typeof error.status === 'number' ? error.status : 0
  if (status >= 500 && status < 600) {
    const safe = /^[A-Za-z0-9_]{1,60}$/.test(code) ? code : error.name === 'AuthRetryableFetchError' ? 'retryable_fetch' : 'unknown'
    const mail = MAIL_FAILURE.test(error.message ?? '') || (code === 'unexpected_failure' && /mail/i.test(error.message ?? ''))
    console.warn(`[cabinet] auth 5xx ${status} ${safe}${mail ? ' mail' : ''}`)
    return mail ? 'mail_down' : 'server_error'
  }
  if (Object.hasOwn(codeMap, code)) return codeMap[code]!
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('invalid login credentials')) return 'invalid_credentials'
  if (message.includes('email not confirmed')) return 'email_not_confirmed'
  if (message.includes('already registered')) return 'user_exists'
  if (message.includes('password should be')) return 'weak_password'
  if (message.includes('code verifier')) return 'other_browser'
  if (error.status === 429) return 'rate_limit'
  if (error.name === 'AuthRetryableFetchError' || message.includes('failed to fetch')) return 'network'
  return 'generic'
}

// What the server log may hold about an auth error: where, the short code and the HTTP status.
// Never the message (it can echo an address), never a token.
export function authLogFields(
  where: string,
  error: { code?: string; status?: number; name?: string } | null | undefined,
) {
  const raw = typeof error?.code === 'string' && error.code ? error.code : (error?.name ?? 'unknown')
  const code = /^[A-Za-z0-9_]{1,60}$/.test(raw) ? raw : 'unknown'
  return {
    where: where.replace(/[^a-z_-]/gi, '').slice(0, 40),
    code,
    ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  }
}

// The auth callback path (`/ru/cabinet/auth/callback`): the proxy leaves its cookies alone.
export const isAuthCallbackPath = (pathname: string) => /^\/(ru|en)\/cabinet\/auth\/callback\/?$/.test(pathname)

// Where a sign-in may send the visitor back to: a path of this locale on this site (the cabinet,
// or the page holding a lead draft). Never another host, never `//`, a backslash or `..`.
// Anything else falls back to the cabinet home.
export function safeNextPath(next: unknown, locale: string): string {
  const fallback = `/${locale}/cabinet`
  if (typeof next !== 'string' || next.length > 700) return fallback
  if (next.includes('//') || next.includes('\\') || next.includes('..') || /[\u0000-\u001f]/.test(next)) return fallback
  const root = `/${locale}`
  const inside = next === root || [`${root}/`, `${root}?`, `${root}#`].some((p) => next.startsWith(p))
  return inside ? next : fallback
}

// The callback URL every flow (email confirmation, reset, Google) comes back to. `flow` tells the
// callback what to say when the exchange fails (a confirmed email can still sign in by password).
export function callbackUrl(origin: string, locale: string, next: string, flow?: 'signup' | 'reset' | 'oauth') {
  const params = new URLSearchParams({ next: safeNextPath(next, locale) })
  if (flow) params.set('flow', flow)
  return `${origin.replace(/\/$/, '')}/${locale}/cabinet/auth/callback?${params.toString()}`
}

// The site's own origin for redirect links in emails and OAuth. In production the configured
// site URL, so a spoofed Host header can never become a redirect target; elsewhere the request host.
export function appOrigin(
  headers: Pick<Headers, 'get'>,
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.NODE_ENV === 'production') return (env.NEXT_PUBLIC_SITE_URL || 'https://firtech.pro').replace(/\/$/, '')
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3001'
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

// Google only (owner 2026-11-21: «с Apple вход не нужен»).
export const oauthProviders = ['google'] as const
export type OAuthProvider = (typeof oauthProviders)[number]
export const isOAuthProvider = (v: unknown): v is OAuthProvider =>
  typeof v === 'string' && (oauthProviders as readonly string[]).includes(v)

// Options for the browser's signInWithOAuth: back to our callback, and Google always shows the
// account picker (a wrong remembered account was a common dead end).
export function oauthOptions(origin: string, locale: string, next: string) {
  return {
    redirectTo: callbackUrl(origin, locale, next, 'oauth'),
    queryParams: { prompt: 'select_account' },
  }
}

// The callback's answer when the exchange failed and there is no session: which message the
// login page shows. A confirmed sign-up that cannot open a session (link opened in another
// browser) is still a confirmed address, so the visitor is told to sign in with the password.
export function callbackFailureKey(code: string | undefined, flow: string | null): AuthErrorKey {
  const key = authErrorKey({ code })
  if (flow === 'signup' && (key === 'other_browser' || key === 'callback')) return 'confirmed_login'
  return key === 'generic' ? 'callback' : key
}
