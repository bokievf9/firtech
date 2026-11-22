import type { Metadata } from 'next'
import { LocaleNotFound } from '@/components/not-found/locale-not-found'

// 404 inside a language (unknown paths under /ru or /en, see [...rest]): header, footer and chat
// come from the locale layout. The metadata is static (a not-found page has no params), so the
// title is the same in both languages: «404» first, noindex so the error is never listed.
export const metadata: Metadata = {
  title: '404: Not found | Fir Tech',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return <LocaleNotFound />
}
