'use client'

import { useEffect } from 'react'
import { refFromSearch, storeRef } from '@/lib/referral'

// Reads `?ref=<slug>` on the home page and keeps it in sessionStorage (`fir-ref`); the contact
// form puts it into the lead as `source: 'ref:<slug>'`. Renders nothing.
export function RefCapture() {
  useEffect(() => {
    storeRef(refFromSearch(window.location.search))
  }, [])
  return null
}
