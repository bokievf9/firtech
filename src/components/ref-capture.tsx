'use client'

import { useEffect } from 'react'
import { refFromSearch, storeRef } from '@/lib/referral'
import { trackEvent } from '@/lib/track-event'

// Reads `?ref=<slug>` on the home page and keeps it in localStorage for 30 days (`fir-ref`); the contact
// form puts it into the lead as `source: 'ref:<slug>'`. Renders nothing.
export function RefCapture() {
  useEffect(() => {
    const slug = refFromSearch(window.location.search)
    storeRef(slug)
    if (slug) trackEvent('ref_click', { ref: slug })
  }, [])
  return null
}
