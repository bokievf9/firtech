'use server'

import { redirect } from 'next/navigation'
import { applyUnsubscribe } from '@/lib/cabinet-profile-server'
import { isLocale } from '@/lib/i18n'

// «Отписаться» on the unsubscribe page: switches the token's setting off and comes back with the result.
// The GET page never changes anything (mail scanners open links), only this POST does.
export async function unsubscribeAction(form: FormData): Promise<void> {
  const raw = String(form.get('locale') ?? '')
  const locale = isLocale(raw) ? raw : 'ru'
  const token = String(form.get('token') ?? '')
  const result = await applyUnsubscribe(token)
  const q = new URLSearchParams({ token })
  if (result.ok) q.set('done', result.already ? 'already' : '1')
  else q.set('error', result.error)
  redirect(`/${locale}/cabinet/unsubscribe?${q.toString()}`)
}
