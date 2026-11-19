'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { authErrorKey, type AuthErrorKey } from '@/lib/cabinet-auth'
import { buttonStyles } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { reportAuthError } from './auth-log'
import { FormMessage } from './ui'

// Second try of the code exchange, in the browser. auth-js reads `sb_flow_id` from this URL and
// the matching verifier from the cookie it wrote when the sign-in started. A full navigation
// follows a success, so the server sees the new session cookies at once.
export function CallbackRetry({
  dict,
  locale,
  next,
  reason,
}: {
  dict: Dict
  locale: Locale
  next: string
  reason: AuthErrorKey
}) {
  const t = dict.cabinet.auth
  const errors = t.errors as Record<string, string>
  const [failed, setFailed] = useState<AuthErrorKey | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const code = new URLSearchParams(window.location.search).get('code')
    const supabase = createClient()
    void (async () => {
      if (!code || !supabase) {
        setFailed(reason)
        return
      }
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error && data.session) {
        window.location.replace(next)
        return
      }
      const existing = await supabase.auth.getSession()
      if (existing.data.session) {
        window.location.replace(next)
        return
      }
      reportAuthError('retry', error)
      const key = authErrorKey(error)
      // The server's reason is usually the more precise one (e.g. a confirmed sign-up).
      setFailed(reason !== 'callback' ? reason : key === 'generic' ? 'callback' : key)
    })()
  }, [next, reason])

  return (
    <div className="rounded-card border border-line bg-surface p-6 md:p-8" aria-live="polite">
      {failed ? (
        <div className="grid justify-items-start gap-5">
          <h1 className="font-display text-xl font-semibold tracking-tight">{t.retryFailedTitle}</h1>
          <FormMessage kind="error">{errors[failed] ?? errors.callback}</FormMessage>
          <Link href={`/${locale}/cabinet/login`} className={buttonStyles.primary}>
            {t.retryLogin}
          </Link>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted">
          {t.retrying}
        </p>
      )}
    </div>
  )
}
