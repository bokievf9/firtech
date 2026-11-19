'use client'

import { useEffect } from 'react'
import { storedRef, withRefStart } from '@/lib/referral'

// With a stored referral every link to @firtech_bot on the page opens the bot with
// `?start=ref_<slug>` (the demo link keeps its own `start`). Runs on mount and when the page adds
// links (the chat). Renders nothing.
export function RefLinks() {
  useEffect(() => {
    const slug = storedRef()
    if (!slug) return
    let frame = 0
    const patch = () => {
      frame = 0
      for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="t.me/firtech_bot"]')) {
        const next = withRefStart(a.href, slug)
        if (next !== a.href) a.href = next
      }
    }
    patch()
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(patch)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
