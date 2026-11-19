import { NextResponse, type NextRequest } from 'next/server'
import { fetchInvoice } from '@/lib/pay-hq'

// Polling endpoint of the payment page: the same HQ call and validation as the page (fetchInvoice
// validates number and key), never cached. 404 for an unknown number or key (deliberately the
// same), 502 when HQ cannot answer.
export const dynamic = 'force-dynamic'

const headers = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex',
}

export async function GET(request: NextRequest, ctx: RouteContext<'/api/pay/[number]'>) {
  const { number } = await ctx.params
  const key = request.nextUrl.searchParams.get('k') ?? ''
  const result = await fetchInvoice(number, key)
  if (result.ok) return NextResponse.json(result, { headers })
  return NextResponse.json(result, { status: result.error === 'not_found' ? 404 : 502, headers })
}
