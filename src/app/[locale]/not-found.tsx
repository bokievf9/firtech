'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { notFoundText } from '@/content/not-found'
import { buttonStyles } from '@/lib/cn'
import { defaultLocale, isLocale } from '@/lib/i18n'

export default function NotFound() {
  const params = useParams<{ locale?: string }>()
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale
  const t = notFoundText[locale]
  return (
    <section className="mx-auto flex min-h-[80dvh] max-w-7xl flex-col items-start justify-center px-4 pt-24 md:px-8">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] md:text-6xl">{t.title}</h1>
      <p className="mt-4 text-lg text-muted">{t.text}</p>
      <Link href={`/${locale}`} className={`${buttonStyles.primary} mt-8`}>
        {t.home}
      </Link>
    </section>
  )
}
