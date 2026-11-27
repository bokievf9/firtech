import { ArrowRight, TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Blueprint } from '@/components/motion/blueprint'
import { TitleReveal } from '@/components/motion/title-reveal'
import { HeroIntro } from '@/components/hero-intro'
import { ReferralLink } from '@/components/referral-link'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { getPricing } from '@/lib/pricing-store'
import { fillReferralPercent } from '@/lib/referral'
import { shareBase } from '@/lib/share'
import { siteUrl, telegramHandle, telegramUrl } from '@/lib/site'

// Referral page: how it works, the rules and a link generator. The reward share is
// `referralPercent` (live pricing), put into the copy through the `{percent}` token.

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/referral'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).referral
  const pricing = await getPricing()
  const fill = (text: string) => fillReferralPercent(text, pricing)
  const title = fill(t.metaTitle)
  const description = fill(t.metaDescription)
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/referral`,
      languages: { ru: '/ru/referral', en: '/en/referral', 'x-default': '/ru/referral' },
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
  const pricing = await getPricing()
  const fill = (text: string) => fillReferralPercent(text, pricing)

  return (
    <>
      <section className="mx-auto site-container pt-32 pb-12 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <TitleReveal as="h1" className="mt-5 max-w-[18ch] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {fill(t.title)}
          </TitleReveal>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto site-container pb-16">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">{t.stepsTitle}</h2>
        <Blueprint as="ol" className="mt-6 grid gap-4 md:mt-10 md:grid-cols-3" lineClassName="hidden h-px w-full md:top-[-1.1rem] md:left-0 md:block">
          {t.steps.map((step, i) => (
            <li key={step.title} className="relative">
              <span data-node aria-hidden="true" className="absolute -top-6 left-6 hidden size-2.5 rounded-full bg-accent md:block" />
              <Reveal delay={i * 0.06} className="h-full">
                <div className="h-full rounded-card border border-line p-6">
                  <span className="font-mono text-sm text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-3 text-xl font-medium">{step.title}</p>
                  <p className="mt-2 leading-relaxed text-muted">{fill(step.text)}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </Blueprint>
      </section>

      <section className="mx-auto grid site-container gap-10 pb-16 lg:grid-cols-2">
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

      <section className="mx-auto site-container pb-28">
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
