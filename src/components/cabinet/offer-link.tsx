'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'

// A link of an offer card: counts the click (Metrika goal `cabinet_offer` and the site event
// `cabinet_offer_click`, no text, only the offer id in the goal) and then just navigates.
export function OfferLink({
  href,
  offer,
  className,
  children,
}: {
  href: string
  offer: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      data-offer={offer}
      className={className}
      onClick={() => {
        track('cabinet_offer', { offer })
        trackEvent('cabinet_offer_click')
      }}
    >
      {children}
    </Link>
  )
}
