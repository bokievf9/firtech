import { z } from 'zod'
import { normalizeTelegram } from './cabinet-data'

// Validation and error mapping for the cabinet's sign-in forms. Pure, so tests import it.
export type AuthErrorKey =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'rate_limit'
  | 'invalid_email'
  | 'invalid_input'
  | 'callback'
  | 'oauth'
  | 'unavailable'
  | 'generic'

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

// Maps a Supabase auth error to a key the dictionary has. Unknown errors are `generic`; nothing
// from the error text reaches the visitor.
export function authErrorKey(error: { code?: string; status?: number; message?: string } | null | undefined): AuthErrorKey {
  if (!error) return 'generic'
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'invalid_credentials'
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'email_not_confirmed'
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) return 'user_exists'
  if (code === 'weak_password' || message.includes('password should be')) return 'weak_password'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error.status === 429) return 'rate_limit'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'invalid_email'
  if (code === 'signup_disabled' || code === 'provider_disabled' || code === 'oauth_provider_not_supported') return 'oauth'
  return 'generic'
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

export const oauthProviders = ['google', 'apple'] as const
export type OAuthProvider = (typeof oauthProviders)[number]
export const isOAuthProvider = (v: unknown): v is OAuthProvider =>
  typeof v === 'string' && (oauthProviders as readonly string[]).includes(v)
