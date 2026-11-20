// Public site theme choice (owner 2026-11-21): a stored choice wins, otherwise the visitor's
// system colour scheme decides. The inline pre-paint script in components/theme-init.tsx mirrors
// this function (it cannot import); tests/site-theme.test.mjs runs that script against it.
import type { SiteTheme } from '@/lib/site-theme'

export function resolveTheme(stored: string | null | undefined, systemDark: boolean): SiteTheme {
  if (stored === 'dark' || stored === 'light') return stored
  return systemDark ? 'dark' : 'light'
}
