import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
import { bookingConfig, generateSlots } from '@/lib/booking'
import { handleHqBooking } from '@/lib/hq-booking'
import { bookedSlots, createHqBooking } from '@/lib/store'

// Always computed per request: slots depend on the current time and on what's already booked.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const days = generateSlots(new Date(), await bookedSlots())
    return NextResponse.json(
      { timeZone: bookingConfig.timeZone, days },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    console.error('[slots] could not read bookings', error)
    return apiError('unavailable', 503)
  }
}

// HQ books a call window for its own lead. Header `x-hq-token` = SITE_BOOKING_TOKEN; answers 200 booked,
// 409 window taken, 401 wrong or missing token, 400 bad body. No email goes to the client.
export async function POST(request: NextRequest) {
  try {
    const result = await handleHqBooking(request.headers.get('x-hq-token'), await request.json().catch(() => null), {
      token: process.env.SITE_BOOKING_TOKEN,
      book: createHqBooking,
    })
    return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('[slots] could not book for HQ', error instanceof Error ? error.message : 'unknown')
    return apiError('unavailable', 503)
  }
}
