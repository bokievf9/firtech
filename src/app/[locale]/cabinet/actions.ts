'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  appOrigin,
  authErrorKey,
  forgotSchema,
  isOAuthProvider,
  resetSchema,
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
// in `cabinet` in the dictionaries. Nothing from a Supabase error message reaches the visitor.
export type FormState = {
  error?: AuthErrorKey | 'profile' | 'telegram' | 'delete_failed'
  notice?: 'check_email' | 'reset_sent' | 'saved' | 'delete_requested'
  email?: string
}

function localeOf(form: FormData): Locale {
  const value = String(form.get('locale') ?? '')
  return isLocale(value) ? value : 'ru'
}

const callbackUrl = async (locale: Locale, next: string) => {
  const origin = appOrigin(await headers())
  return `${origin}/${locale}/cabinet/auth/callback?next=${encodeURIComponent(next)}`
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const parsed = signInSchema.safeParse({ email: form.get('email') ?? '', password: form.get('password') ?? '' })
  if (!parsed.success) return { error: 'invalid_credentials' }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: authErrorKey(error), email: parsed.data.email }
  redirect(`/${locale}/cabinet`)
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
      emailRedirectTo: await callbackUrl(locale, `/${locale}/cabinet`),
      data: { name, locale, telegram, marketing_consent: marketing },
    },
  })
  if (error) return { error: authErrorKey(error), email }
  // Confirmation switched off in Supabase: the session exists already.
  if (data.session) redirect(`/${locale}/cabinet`)
  return { notice: 'check_email', email }
}

export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form)
  const parsed = forgotSchema.safeParse({ email: form.get('email') ?? '' })
  if (!parsed.success) return { error: 'invalid_email' }
  const supabase = await createClient()
  if (!supabase) return { error: 'unavailable' }
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await callbackUrl(locale, `/${locale}/cabinet/reset`),
  })
  if (error && authErrorKey(error) === 'rate_limit') return { error: 'rate_limit', email: parsed.data.email }
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
  if (error) return { error: authErrorKey(error) }
  redirect(`/${locale}/cabinet`)
}

export async function oauthAction(form: FormData): Promise<void> {
  const locale = localeOf(form)
  const provider = form.get('provider')
  const supabase = await createClient()
  if (!supabase || !isOAuthProvider(provider)) redirect(`/${locale}/cabinet/login?error=oauth`)
  // The language rides in the redirect so a first OAuth login gets the right profile locale.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: await callbackUrl(locale, `/${locale}/cabinet`) },
  })
  if (error || !data.url) redirect(`/${locale}/cabinet/login?error=oauth`)
  redirect(data.url)
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
