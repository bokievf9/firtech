'use client'

import { useEffect } from 'react'
import type { SiteEventName } from '@/lib/site-events'
import { trackEvent } from '@/lib/track-event'

// Counts one view of a server-rendered page for the пульт's numbers (pay page, blog article).
export function TrackView({ name }: { name: SiteEventName }) {
  useEffect(() => {
    trackEvent(name)
  }, [name])
  return null
}
