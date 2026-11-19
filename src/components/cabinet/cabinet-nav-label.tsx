'use client'

import { useSyncExternalStore } from 'react'
import { hasSessionCookie } from '@/lib/cabinet-client'

const noop = () => () => {}

// The cabinet link's text (owner 2026-11-20): «Начать» / «Get started» for a signed-out visitor,
// «Кабинет» / «Cabinet» with a session. The prerendered HTML says «Начать»; the browser switches
// it after hydration from the session cookie, without loading Supabase code.
export function CabinetNavLabel({ signedIn, start }: { signedIn: string; start: string }) {
  const inSession = useSyncExternalStore(
    noop,
    () => hasSessionCookie(document.cookie),
    () => false,
  )
  return <>{inSession ? signedIn : start}</>
}
