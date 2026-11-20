import { ArrowRight, TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HeroIntro } from '@/components/hero-intro'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { telegramHandle, telegramUrl } from '@/lib/site'

// «Как оплатить»: a first-time guide to paying in USDT (go-live copy, owner 2026-11-21). Words only:
// no amounts, no fees of ours. Linked from the pay page, the terms, the FAQ, the cabinet and the footer.

export async function generateMetadata({ params }: PageProps<'/[locale]/pay-how'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).payHow
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/pay-how`,
      languages: { ru: '/ru/pay-how', en: '/en/pay-how' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: { ...shareBase(locale).openGraph, title: t.metaTitle, description: t.metaDescription, url: `/${locale}/pay-how` },
  }
}

export default async function PayHowPage({ params }: PageProps<'/[locale]/pay-how'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDict(locale).payHow

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[18ch] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <ol className="grid gap-4 md:grid-cols-2">
          {t.sections.map((section, i) => (
            <li key={section.id}>
              <Reveal delay={(i % 2) * 0.06} className="h-full">
                <div id={section.id} className="h-full scroll-mt-28 rounded-card border border-line p-6">
                  <span className="font-mono text-sm text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="mt-3 text-xl font-medium">{section.title}</h2>
                  <div className="mt-3 grid gap-3 leading-relaxed text-muted">
                    {section.text.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {section.list.length > 0 && (
                      <ul className="grid gap-2 pl-5 marker:text-accent-text [list-style:disc]">
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="mt-6">
          <Link
            href={`/${locale}/terms#terms-payment`}
            className="text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
          >
            {t.termsLink}
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-28 md:px-8">
        <div className="flex flex-col items-start gap-6 rounded-card border border-accent-text/30 p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <p className="font-display text-2xl font-semibold md:text-3xl">{t.ctaTitle}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/builder`} data-cta="pay_how_builder" className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuilder}
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            {telegramUrl && (
              <a href={telegramUrl} data-place="pay_how" target="_blank" rel="noopener noreferrer" className={buttonStyles.secondary}>
                <TelegramLogo size={18} weight="fill" />
                {t.ctaTelegram} {telegramHandle}
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
