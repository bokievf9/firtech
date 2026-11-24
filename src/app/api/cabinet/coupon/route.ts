import { NextResponse } from 'next/server'
import { couponValid } from '@/lib/cabinet-data'
import { fetchClientByEmail } from '@/lib/cabinet-hq'
import { peekLeadUser } from '@/lib/lead-session'
import { getPricing } from '@/lib/pricing-store'
import { cabinetEnabled } from '@/lib/supabase/config'

// GET /api/cabinet/coupon: the signed-in client's cabinet coupon, for the builder estimate (the discount line) and the
// lead (`brief.coupon`). HQ is the source of truth (contract coupon/contract.md): `percent` is the HQ coupon's, else the
// site's `cabinetCouponPercent`; `valid` = not used and not expired. Signed out, or HQ silent: `{ valid: false }`.
export const dynamic = 'force-dynamic'

const reply = (body: object) => NextResponse.json(body, { headers: { 'cache-control': 'private, no-store' } })

export async function GET() {
  if (!cabinetEnabled()) return reply({ valid: false })
  const user = await peekLeadUser().catch(() => null)
  if (!user) return reply({ valid: false })
  const client = await fetchClientByEmail(user.email)
  if (!client.ok || !couponValid(client.data.coupon)) return reply({ valid: false })
  const { coupon } = client.data
  const percent = coupon.percent > 0 ? coupon.percent : (await getPricing()).cabinetCouponPercent
  return reply({ valid: true, code: coupon.code, percent, expiresAt: coupon.expiresAt })
}
