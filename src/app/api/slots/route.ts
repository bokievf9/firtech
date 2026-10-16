import 'server-only'
import { NextResponse } from 'next/server'
import { bookingConfig, generateSlots } from '@/lib/booking'
import { bookedSlots } from '@/lib/store'

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
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
  }
}
