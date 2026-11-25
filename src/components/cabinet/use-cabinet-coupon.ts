'use client'

import { useEffect, useState } from 'react'

// The signed-in client's valid cabinet coupon (GET /api/cabinet/coupon), for the estimate and the lead. null while
// loading, signed out, used, expired or when HQ did not answer: the estimate then shows no discount.
export type CabinetCoupon = { code: string; percent: number; expiresAt: string }

export async function fetchCabinetCoupon(): Promise<CabinetCoupon | null> {
  try {
    const res = await fetch('/api/cabinet/coupon', { cache: 'no-store' })
    const body = (await res.json().catch(() => null)) as { valid?: boolean; code?: string; percent?: number; expiresAt?: string } | null
    if (!body?.valid || typeof body.percent !== 'number' || !(body.percent > 0) || typeof body.expiresAt !== 'string') return null
    if (!(Date.parse(body.expiresAt) > Date.now())) return null
    return { code: typeof body.code === 'string' ? body.code : 'cabinet10', percent: body.percent, expiresAt: body.expiresAt }
  } catch {
    return null
  }
}

export function useCabinetCoupon(): CabinetCoupon | null {
  const [coupon, setCoupon] = useState<CabinetCoupon | null>(null)
  useEffect(() => {
    let alive = true
    void fetchCabinetCoupon().then((c) => {
      if (alive) setCoupon(c)
    })
    return () => {
      alive = false
    }
  }, [])
  return coupon
}
