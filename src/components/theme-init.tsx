'use client'

import { useServerInsertedHTML } from 'next/navigation'
import { themeScript } from '@/lib/site-theme'

// Puts the theme script into the server HTML only (it never re-renders on the client, so React
// does not warn about a script tag). It runs before the first paint, so there is no flash.
export function ThemeInit() {
  useServerInsertedHTML(() => <script dangerouslySetInnerHTML={{ __html: themeScript }} />)
  return null
}
