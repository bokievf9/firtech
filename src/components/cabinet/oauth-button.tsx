'use client'

import { useState } from 'react'
import type { Dict } from '@/content'
import { clearVerifierCookies } from '@/lib/auth-cookies'
import { authErrorKey, oauthOptions, type OAuthProvider } from '@/lib/cabinet-auth'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { reportAuthError } from './auth-log'
import { FormMessage } from './ui'

// «Продолжить с Google»: the OAuth flow starts in the browser with the browser client, so the PKCE
// verifier cookie is written by the same browser (and the same cookie code) that later brings the
// code back to /cabinet/auth/callback. Google always shows its account picker.
export function OAuthButton({
  dict,
  locale,
  provider,
  next,
  onBeforeRedirect,
}: {
  dict: Dict
  locale: Locale
  provider: OAuthProvider
  next: string
  onBeforeRedirect?: () => void
}) {
  const t = dict.cabinet.auth
  const errors = t.errors as Record<string, string>
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setError(null)
    const supabase = createClient()
    if (!supabase) {
      setError(errors.unavailable ?? errors.generic ?? '')
      return
    }
    clearVerifierCookies()
    setPending(true)
    onBeforeRedirect?.()
    const { error: failure } = await supabase.auth.signInWithOAuth({
      provider,
      options: oauthOptions(window.location.origin, locale, next),
    })
    if (failure) {
      reportAuthError('oauth_start', failure)
      const key = authErrorKey(failure)
      setError(errors[key === 'generic' ? 'oauth' : key] ?? errors.oauth ?? '')
      setPending(false)
    }
    // On success the browser is already leaving for Google.
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        data-provider={provider}
        className={cn(buttonStyles.secondary, 'w-full')}
      >
        {pending ? t.redirecting : provider === 'google' ? t.google : t.apple}
      </button>
      {error && <FormMessage kind="error">{error}</FormMessage>}
    </div>
  )
}
