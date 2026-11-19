import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDict } from '@/content'
import { ymId } from '@/lib/analytics'
import { homeAnchor } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { telegramHandle, telegramUrl } from '@/lib/site'
import { shareBase } from '@/lib/share'
import { LegalDoc } from '@/components/legal-doc'

// Privacy policy. This is a plain-language template written for the studio, not legal advice: the
// owner should have it checked by a lawyer before launch (and again when the form, storage or
// analytics change). It deliberately does not claim compliance with any specific law. Texts live
// in `privacy` in src/content/ru.ts and en.ts.

const optOutUrl = {
  ru: 'https://yandex.ru/support/metrica/general/opt-out.html',
  en: 'https://yandex.com/support/metrica/general/opt-out.html',
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).privacy
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: { ru: '/ru/privacy', en: '/en/privacy' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/privacy`,
    },
  }
}

const linkClass =
  'text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent'

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDict(locale).privacy
  // The analytics section only describes Metrika when it is actually switched on.
  const sections = t.sections.filter((section) => section.id !== 'analytics' || ymId() !== null)

  return (
    <LegalDoc
      t={t}
      idPrefix="privacy"
      sections={sections}
      extra={(section) => (
        <>
          {section.id === 'analytics' && (
            <p>
              <a
                href={optOutUrl[locale]}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {t.optOut}
              </a>
            </p>
          )}
          {section.id === 'rights' && (
            <p>
              {telegramUrl ? t.contactTelegram : t.contactForm}{' '}
              {telegramUrl ? (
                <a
                  href={telegramUrl}
                  data-place="privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {telegramHandle}
                </a>
              ) : (
                <Link href={homeAnchor(locale, 'contact')} className={linkClass}>
                  {t.contactFormLink}
                </Link>
              )}
            </p>
          )}
        </>
      )}
    />
  )
}
