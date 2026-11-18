'use client'

import { useParams } from 'next/navigation'
import { NotFoundView } from '@/components/not-found/not-found-view'
import { defaultLocale, isLocale } from '@/lib/i18n'

// 404 inside a language (unknown paths under /ru or /en, see [...rest]): header, footer and chat
// come from the locale layout.
export default function NotFound() {
  const params = useParams<{ locale?: string }>()
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale
  return <NotFoundView locale={locale} />
}
