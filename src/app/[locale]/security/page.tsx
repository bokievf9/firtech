import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { LegalDoc } from '@/components/legal-doc'

// «Безопасность и данные» (owner audit 2026-11-24): a plain description of where client data lives,
// who sees it, what reaches the model, backups, access, deletion and analytics. Facts only, from
// docs/security-2026-11-23.md and the HQ contract; change the text when the architecture changes.
// Texts live in `security` in src/content/ru.ts and en.ts.

export async function generateMetadata({ params }: PageProps<'/[locale]/security'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).security
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/security`,
      languages: { ru: '/ru/security', en: '/en/security', 'x-default': '/ru/security' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/security`,
    },
  }
}

const linkClass =
  'text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text'

export default async function SecurityPage({ params }: PageProps<'/[locale]/security'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDict(locale).security

  return (
    <LegalDoc
      t={t}
      idPrefix="security"
      sections={t.sections}
      extra={(section) =>
        section.id === 'deletion' ? (
          <p>
            <Link href={`/${locale}/privacy`} className={linkClass}>
              {t.privacyLink}
            </Link>
          </p>
        ) : null
      }
    />
  )
}
