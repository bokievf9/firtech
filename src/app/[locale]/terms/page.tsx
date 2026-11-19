import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LegalDoc } from '@/components/legal-doc'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'

// Terms of service (оферта): a skeleton. The owner's requisites and legal choices are marked with
// `terms.placeholder` and a lawyer checks the whole text before it is used. Texts live in `terms`
// in src/content/ru.ts and en.ts.

export async function generateMetadata({ params }: PageProps<'/[locale]/terms'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).terms
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/terms`,
      languages: { ru: '/ru/terms', en: '/en/terms' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/terms`,
    },
  }
}

export default async function TermsPage({ params }: PageProps<'/[locale]/terms'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.terms
  return (
    <LegalDoc
      t={t}
      idPrefix="terms"
      sections={t.sections}
      extra={(section) =>
        section.id === 'data' ? (
          <p>
            <Link
              href={`/${locale}/privacy`}
              className="text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              {t.privacyLink}
            </Link>
          </p>
        ) : null
      }
    />
  )
}
