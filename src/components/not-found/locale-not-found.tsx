'use client'

import { useParams } from 'next/navigation'
import { defaultLocale, isLocale } from '@/lib/i18n'
import { NotFoundView } from './not-found-view'

// The locale is read from the URL, so this part of the 404 is a client component.
export function LocaleNotFound() {
  const params = useParams<{ locale?: string }>()
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale
  return <NotFoundView locale={locale} />
}
