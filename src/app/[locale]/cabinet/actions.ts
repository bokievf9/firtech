'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  appOrigin,
  authErrorKey,
  authLogFields,
  callbackUrl,
  forgotSchema,
  resetSchema,
  safeNextPath,
  signInSchema,
  signUpInput,
  validationKey,
  type AuthErrorKey,
} from '@/lib/cabinet-auth'
import { normalizeTelegram } from '@/lib/cabinet-data'
import { createClientTicket, fetchClientByEmail, syncClientToHq } from '@/lib/cabinet-hq'
import { requireCabinetUser } from '@/lib/cabinet-session'
import { isLocale, type Locale } from '@/lib/i18n'
import { supabaseConfig } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

// Server actions of the cabinet. Each returns a small state the form shows inline; the texts live
// in `cabinet` in the dictionaries. Nothing from a Supabase error message reaches the visitor; the
// short code goes to the server log. Google sign-in starts in the browser (oauth-button.tsx).
// `stay=1` (the compact form next to a lead form) answers `signed_in` instead of redirecting, and
// `next` (a path of this locale, see safeNextPath) is where the email links come back to.
export type FormState = {
  error?: AuthErrorKey | 'profile' | 'telegram' | 'delete_failed'
  notice?: 'check_email' | 'reset_sent' | 'saved' | 'delete_requested' | 'signed_in' | 'resent'
  email?: string
  // The address exists but is not confirmed yet: the form offers «Отправить письмо ещё раз».
  canResend?: boolean
}

function localeOf(form: FormData): Locale {
  const value = String(form.get('locale') ?? '')
  return isLocale(value) ? value : 'ru'
}

const nextOf = (form: FormData, locale: Locale) => safeNextPath(String(form.get('next') ?? ''), locale)
const stays = (form: FormData) => form.get('stay') === '1'

function logAuth(where: string, error: { code?: string; status?: number; name?: string }) {
  console.warn('[cabinet] auth error', authLogFields(where, error))
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const parsed = signInSchema.safeParse({ email: form.get('email') ?? '', password: form.get('password') ?? '' })
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === 'email' ? 'invalid_email' : 'invalid_credentials' }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    logAuth('sign_in', error)
    const key = authErrorKey(error)
    return { error: key, email: parsed.data.email, canResend: key === 'email_not_confirmed' }
  }
  if (stays(form)) return { notice: 'signed_in', email: parsed.data.email }
  redirect(nextOf(form, locale))
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const { parsed, telegramOk } = signUpInput(form)
  if (!telegramOk) return { error: 'telegram' }
  if (!parsed.success) return { error: validationKey(parsed.error) }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { email, password, name, telegram, marketing } = parsed.data
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(appOrigin(await headers()), locale, nextOf(form, locale), 'signup'),
      data: { name, locale, telegram, marketing_consent: marketing },
    },
  })
  if (error) {
    logAuth('sign_up', error)
    return { error: authErrorKey(error), email }
  }
  // Confirmation switched off in Supabase: the session exists already.
  if (data.session) {
    if (stays(form)) return { notice: 'signed_in', email }
    redirect(nextOf(form, locale))
  }
  // An existing confirmed address gets no letter and no error from Supabase (identities is empty):
  // say so instead of promising a letter that never comes.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: 'user_exists', email }
  }
  return { notice: 'check_email', email }
}

// «Отправить письмо ещё раз»: the sign-up confirmation again. Supabase's own mail sends at most
// two letters an hour per project, so a refusal is shown as that limit, not as a failure.
export async function resendAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const parsed = forgotSchema.safeParse({ email: form.get('email') ?? '' })
  if (!parsed.success) return { error: 'invalid_email' }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(appOrigin(await headers()), locale, nextOf(form, locale), 'signup') },
  })
  if (error) {
    logAuth('resend', error)
    const key = authErrorKey(error)
    return { error: key === 'rate_limit' ? 'email_rate_limit' : key, email: parsed.data.email, canResend: true }
  }
  return { notice: 'resent', email: parsed.data.email, canResend: true }
}

export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const parsed = forgotSchema.safeParse({ email: form.get('email') ?? '' })
  if (!parsed.success) return { error: 'invalid_email' }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl(appOrigin(await headers()), locale, `/${locale}/cabinet/reset`, 'reset'),
  })
  if (error) {
    logAuth('forgot', error)
    const key = authErrorKey(error)
    if (key === 'rate_limit' || key === 'email_rate_limit' || key === 'email_unavailable')
      return { error: key === 'rate_limit' ? 'email_rate_limit' : key, email: parsed.data.email }
  }
  // Same answer whether or not the address has an account.
  return { notice: 'reset_sent', email: parsed.data.email }
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const parsed = resetSchema.safeParse({ password: form.get('password') ?? '' })
  if (!parsed.success) return { error: 'weak_password' }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    logAuth('reset', error)
    return { error: authErrorKey(error) }
  }
  redirect(`/${locale}/cabinet?password=updated`)
}

export async function logoutAction(form: FormData): Promise<void> {
  const locale = localeOf(form)
  const supabase = await createClient()
  await supabase?.auth.signOut()
  redirect(`/${locale}/cabinet/login`)
}

const profileSchema = z.object({
  name: z.string().trim().max(80),
  locale: z.enum(['ru', 'en']),
  marketing: z.boolean(),
})

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const { supabase, user } = await requireCabinetUser(locale)
  const telegram = normalizeTelegram(String(form.get('telegram') ?? ''))
  if (telegram === null) return { error: 'telegram' }
  const parsed = profileSchema.safeParse({
    name: form.get('name') ?? '',
    locale: form.get('profileLocale') ?? locale,
    marketing: form.get('marketing') === 'on',
  })
  if (!parsed.success) return { error: 'profile' }
  const { error } = await supabase
    .from('profiles')
    .update({
      name: parsed.data.name || null,
      telegram: telegram || null,
      locale: parsed.data.locale,
      marketing_consent: parsed.data.marketing,
    })
    .eq('id', user.id)
  if (error) return { error: 'profile' }
  return { notice: 'saved' }
}

// Deleting the account: with SUPABASE_SERVICE_ROLE_KEY the auth user (and, by cascade, the profile)
// is removed right away. Without the key the request goes to support as a ticket, which is also
// the fallback when the deletion itself fails.
export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const { supabase, user } = await requireCabinetUser(locale)
  const config = supabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (config && serviceKey) {
    const admin = createAdminClient(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (!error) {
      await supabase.auth.signOut()
      redirect(`/${locale}`)
    }
    console.warn('[cabinet] account deletion failed, falling back to a ticket')
  }
  const email = user.email ?? ''
  let client = await fetchClientByEmail(email)
  if (!client.ok && client.error === 'not_found') {
    const { data: profile } = await supabase.from('profiles').select('email,name,telegram,locale,marketing_consent').eq('id', user.id).maybeSingle()
    if (profile) await syncClientToHq(user.id, profile)
    client = await fetchClientByEmail(email)
  }
  if (!client.ok) return { error: 'delete_failed' }
  const text = locale === 'ru' ? 'Удалить аккаунт' : 'Delete my account'
  const ticket = await createClientTicket(client.data.client.id, `${text}: ${email}`)
  return ticket.ok ? { notice: 'delete_requested' } : { error: 'delete_failed' }
}
