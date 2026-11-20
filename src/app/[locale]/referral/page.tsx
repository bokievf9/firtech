import { ArrowRight, TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HeroIntro } from '@/components/hero-intro'
import { ReferralLink } from '@/components/referral-link'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { fillReferralPercent as fill } from '@/lib/referral'
import { shareBase } from '@/lib/share'
import { siteUrl, telegramHandle, telegramUrl } from '@/lib/site'

// Referral page: how it works, the rules and a link generator. The reward share is
// `referralPercent` (pricing.ts), put into the copy through the `{percent}` token.

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/referral'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).referral
  const title = fill(t.metaTitle)
  const description = fill(t.metaDescription)
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/referral`,
      languages: { ru: '/ru/referral', en: '/en/referral' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: { ...shareBase(locale).openGraph, title, description, url: `/${locale}/referral` },
  }
}

export default async function ReferralPage({ params }: PageProps<'/[locale]/referral'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.referral

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[18ch] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {fill(t.title)}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">{t.stepsTitle}</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {t.steps.map((step, i) => (
            <li key={step.title}>
              <Reveal delay={i * 0.06} className="h-full">
                <div className="h-full rounded-card border border-line p-6">
                  <span className="font-mono text-sm text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-3 text-xl font-medium">{step.title}</p>
                  <p className="mt-2 leading-relaxed text-muted">{fill(step.text)}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 md:px-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold md:text-3xl">{t.rulesTitle}</h2>
          <ul className="mt-5 grid max-w-[60ch] gap-3 pl-5 leading-relaxed text-muted marker:text-accent-text [list-style:disc]">
            {t.rules.map((rule) => (
              <li key={rule}>{fill(rule)}</li>
            ))}
          </ul>
        </div>
        <ReferralLink dict={dict} locale={locale} origin={siteUrl} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-28 md:px-8">
        <div className="flex flex-col items-start gap-6 rounded-card border border-accent-text/30 p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <p className="font-display text-2xl font-semibold md:text-3xl">{t.ctaTitle}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/builder`} data-cta="referral_builder" className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuilder}
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            {telegramUrl && (
              <a
                href={telegramUrl}
                data-place="referral"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles.secondary}
              >
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
