'use client'

import { authLogFields } from '@/lib/cabinet-auth'

// Sends the short code of a browser-side auth error to the server log (POST /api/cabinet/auth-log),
// so the owner sees why a Google sign-in or a retry failed. Never the message, never a token.
export function reportAuthError(where: string, error: { code?: string; status?: number; name?: string } | null | undefined) {
  try {
    void fetch('/api/cabinet/auth-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(authLogFields(where, error)),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Logging must never break the form.
  }
}
