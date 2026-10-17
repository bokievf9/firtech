import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDict } from '@/content'
import { ymId } from '@/lib/analytics'
import { homeAnchor } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { telegramHandle, telegramUrl } from '@/lib/site'
import { shareBase } from '@/lib/share'

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
    <article className="mx-auto max-w-3xl px-4 pt-32 pb-24 md:px-8 md:pt-40 md:pb-36">
      <header>
        <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{t.eyebrow}</p>
        {/* "конфиденциальности" is one long word: smaller on phones, hyphenated if still too wide. */}
        <h1 className="mt-5 text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance hyphens-auto sm:text-[2.6rem] md:text-6xl">
          {t.title}
        </h1>
        <p className="mt-5 font-mono text-[13px] text-faint">{t.updated}</p>
        <p className="mt-8 max-w-[62ch] text-lg leading-relaxed text-muted">{t.intro}</p>
      </header>

      <div className="mt-14 grid gap-12 border-t border-line pt-12">
        {sections.map((section, i) => (
          <section key={section.id} aria-labelledby={`privacy-${section.id}`}>
            <h2
              id={`privacy-${section.id}`}
              className="flex items-baseline gap-4 text-2xl font-semibold tracking-[-0.02em] md:text-[1.75rem]"
            >
              <span className="font-mono text-sm font-normal text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              {section.title}
            </h2>
            <div className="mt-4 grid max-w-[65ch] gap-4 leading-relaxed text-muted">
              {section.text.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {section.list.length > 0 && (
                <ul className="grid gap-2 pl-5 marker:text-accent [list-style:disc]">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
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
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
