'use client'

import { useParams } from 'next/navigation'
import { getDict } from '@/content'
import { defaultLocale, isLocale } from '@/lib/i18n'
import { telegramUrl } from '@/lib/site'

// Unknown invoice number or wrong key (the same on purpose): HTTP 404 with a plain explanation.
export default function PayNotFound() {
  const params = useParams<{ locale?: string }>()
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale
  const t = getDict(locale).pay
  return (
    <section className="mx-auto max-w-2xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <div className="rounded-card border border-line bg-surface p-6 md:p-8">
        <h1 className="text-2xl font-semibold">{t.notFoundTitle}</h1>
        <p className="mt-3 text-muted">{t.notFoundText}</p>
        {telegramUrl && (
          <p className="mt-6">
            <a
              href={telegramUrl}
              className="text-accent-text underline underline-offset-4 hover:text-fg"
            >
              {t.support}
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
