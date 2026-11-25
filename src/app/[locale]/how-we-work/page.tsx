import { ArrowRight, ArrowUpRight, ChatCircleDots, Check } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { fillGuarantee } from '@/lib/guarantee'
import { getPricing } from '@/lib/pricing-store'
import { GuaranteeLine } from '@/components/guarantee-line'
import { PageHero, LightStrong } from '@/components/page-hero'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'

export async function generateMetadata({ params }: PageProps<'/[locale]/how-we-work'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).how
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/how-we-work`,
      languages: { ru: '/ru/how-we-work', en: '/en/how-we-work', 'x-default': '/ru/how-we-work' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/how-we-work`,
    },
  }
}

// «Как мы работаем» (owner 2026-11-22): the long version of the home #process block. The stages with
// what the client does, sees in the cabinet and who answers; acceptance, payment by stages, the
// guarantee, what happens when something is not liked, the tools and how approvals work.
export default async function HowWeWorkPage({ params }: PageProps<'/[locale]/how-we-work'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const pricing = await getPricing()
  const t = dict.how
  const rows = [
    ['you', t.you],
    ['cabinet', t.cabinet],
    ['who', t.who],
  ] as const

  return (
    <>
      <PageHero light={t.titleLight} strong={t.titleStrong} lead={t.sub} portal compact>
        <Link href={`/${locale}/builder`} data-cta="how_build" className={cn(buttonStyles.primary, 'group')}>
          {dict.nav.cta}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        <ChatOpenButton source="how" fallbackHref={`/${locale}#demo`} className={buttonStyles.glass}>
          <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
          {dict.nav.ask}
        </ChatOpenButton>
      </PageHero>

      <section className="border-y border-line bg-surface/40" aria-labelledby="stages">
        <div className="mx-auto max-w-7xl px-4 py-section md:px-8">
          <Reveal>
            <h2 id="stages" className="h-display h-display-section">
              <LightStrong text={t.stagesTitle} />
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-gutter">
            {t.stages.map((stage) => (
              <li key={stage.title}>
                <Reveal delay={0.04} className="h-full">
                  <div className="grid gap-6 rounded-card border border-line bg-surface p-6 md:p-8 lg:grid-cols-12" data-how-stage>
                    <div className="lg:col-span-4">
                      <h3 className="font-display text-title-3 font-bold tracking-tight">{stage.title}</h3>
                      <p className="mt-3 leading-relaxed text-muted">{stage.text}</p>
                    </div>
                    <dl className="grid gap-5 sm:grid-cols-3 lg:col-span-8">
                      {rows.map(([key, label]) => (
                        <div key={key} className="rounded-tile border border-line bg-bg/50 p-4">
                          <dt className="text-xs text-faint">{label}</dt>
                          <dd className="mt-2 text-[15px] leading-snug">{stage[key]}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-gutter px-4 py-section md:grid-cols-2 md:px-8">
        <Reveal>
          <div className="h-full rounded-card border border-line p-6 md:p-8">
            <h2 className="font-display text-title-2 font-light tracking-tight [&_strong]:font-extrabold"><LightStrong text={t.acceptanceTitle} /></h2>
            <ul className="mt-6 grid gap-3">
              {t.acceptance.map((line) => (
                <li key={line} className="flex gap-3 text-muted">
                  <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="h-full rounded-card border border-line p-6 md:p-8">
            <h2 className="font-display text-title-2 font-light tracking-tight [&_strong]:font-extrabold"><LightStrong text={t.paymentTitle} /></h2>
            <p className="mt-6 leading-relaxed text-muted">{t.payment}</p>
            <Link
              href={`/${locale}/pay-how`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
            >
              {t.paymentLink}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-gutter px-4 py-section md:grid-cols-2 md:px-8">
          <Reveal>
            <h2 className="font-display text-title-2 font-light tracking-tight [&_strong]:font-extrabold"><LightStrong text={t.guaranteeTitle} /></h2>
            <GuaranteeLine dict={dict} locale={locale} pricing={pricing} className="mt-6 max-w-[52ch]" />
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted">{t.guaranteeRule}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-title-2 font-light tracking-tight [&_strong]:font-extrabold"><LightStrong text={t.dislikeTitle} /></h2>
            <ul className="mt-6 grid gap-3">
              {t.dislike.map((raw) => {
                const line = fillGuarantee(raw, locale, pricing)
                return (
                <li key={line} className="flex gap-3 text-muted">
                  <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
                )
              })}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-gutter px-4 py-section md:px-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <h2 className="font-display text-title-2 font-light tracking-tight [&_strong]:font-extrabold"><LightStrong text={t.toolsTitle} /></h2>
          <p className="mt-4 max-w-[56ch] leading-relaxed text-muted">{t.toolsText}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {t.tools.map((tool) => (
              <li key={tool.name} className="rounded-card border border-line p-5">
                <p className="font-medium">{tool.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{tool.text}</p>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.08} className="lg:col-span-5">
          <div className="h-full rounded-card border border-accent-text/30 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_70%)] p-6 md:p-8">
            <h2 className="font-display text-title-2 font-light tracking-tight [&_strong]:font-extrabold"><LightStrong text={t.approvalsTitle} /></h2>
            <p className="mt-4 leading-relaxed text-muted">{t.approvals}</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-section md:px-8">
        <Reveal>
          <div className="rounded-card border border-line bg-surface p-6 md:p-10">
            <h2 className="h-display h-display-section"><LightStrong text={t.ctaTitle} /></h2>
            <p className="mt-4 max-w-[56ch] text-muted">{t.ctaText}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/${locale}/builder`} data-cta="how_final" className={cn(buttonStyles.primary, 'group')}>
                {dict.nav.cta}
                <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <ChatOpenButton source="how_final" fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
                {dict.nav.ask}
              </ChatOpenButton>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
