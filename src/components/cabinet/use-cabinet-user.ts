'use client'

import { useCallback, useEffect, useState } from 'react'

// Who is signed in, for the lead forms: GET /api/cabinet/me gives the email and name to prefill.
// `off` = the cabinet is not configured on this server: leads go through without an account.
export type CabinetUser = { email: string; name: string; telegram: string }
export type CabinetUserState =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'off' }
  | { status: 'in'; user: CabinetUser }

type MeBody = { enabled?: boolean; signedIn?: boolean; email?: string; name?: string; telegram?: string }

export async function fetchCabinetUser(): Promise<CabinetUserState> {
  try {
    const res = await fetch('/api/cabinet/me', { cache: 'no-store' })
    const body = (await res.json().catch(() => null)) as MeBody | null
    if (!body) return { status: 'out' }
    if (body.enabled === false) return { status: 'off' }
    if (body.signedIn && body.email) {
      return { status: 'in', user: { email: body.email, name: body.name ?? '', telegram: body.telegram ?? '' } }
    }
    return { status: 'out' }
  } catch {
    return { status: 'out' }
  }
}

export function useCabinetUser() {
  const [state, setState] = useState<CabinetUserState>({ status: 'loading' })
  const refresh = useCallback(async () => {
    const next = await fetchCabinetUser()
    setState(next)
    return next
  }, [])
  useEffect(() => {
    let alive = true
    // Asked once per form even without a session cookie: the server also says whether the cabinet
    // exists at all (`off` keeps the old anonymous form). Cheap: no Supabase call without a cookie.
    void fetchCabinetUser().then((s) => {
      if (alive) setState(s)
    })
    return () => {
      alive = false
    }
  }, [])
  return { state, refresh }
}
