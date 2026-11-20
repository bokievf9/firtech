'use client'

import { useSyncExternalStore } from 'react'
import type { SiteTheme } from './site-theme'

const read = (): SiteTheme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}

// The public site's current theme (`<html data-theme>`), live when the visitor flips the switch.
export function useSiteTheme(): SiteTheme {
  return useSyncExternalStore(subscribe, read, () => 'light' as SiteTheme)
}
