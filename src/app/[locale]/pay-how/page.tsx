import { ArrowRight, TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHero, LightStrong } from '@/components/page-hero'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { telegramHandle, telegramUrl } from '@/lib/site'

// «Как оплатить»: how payment works: estimate and invoice, card or invoice, stages, guarantee first (owner 2026-11-24, no crypto).
// Words only: no amounts, no fees of ours. Linked from the pay page, the terms, the FAQ, the cabinet and the footer.

export async function generateMetadata({ params }: PageProps<'/[locale]/pay-how'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).payHow
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/pay-how`,
      languages: { ru: '/ru/pay-how', en: '/en/pay-how', 'x-default': '/ru/pay-how' },
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
      <PageHero light={t.titleLight} strong={t.titleStrong} lead={t.sub} narrow>
        <p data-guarantee-banner className="max-w-[60ch] rounded-card border border-accent-text/30 bg-pine/40 px-4 py-3 text-callout font-medium">{t.banner}</p>
      </PageHero>

      <section className="mx-auto max-w-3xl px-4 pb-16 md:px-8">
        <ol className="grid border-t border-line">
          {t.sections.map((section, i) => (
            <li key={section.id}>
              <Reveal className="h-full">
                <div id={section.id} className="scroll-mt-28 border-b border-line py-8">
                  <span className="font-mono text-sm text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="mt-3 text-title-3 font-bold">{section.title}</h2>
                  <div className="mt-3 grid max-w-[65ch] gap-3 leading-relaxed text-muted">
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
        <p data-entity-note className="mt-6 max-w-[60ch] text-callout text-muted">{t.entityNote}</p>
        <p className="mt-4">
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
          <p className="h-display h-display-section max-w-[24ch]"><LightStrong text={t.ctaTitle} /></p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/builder`} data-cta="pay_how_builder" className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuilder}
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            {telegramUrl && (
              <a href={telegramUrl} data-place="pay_how" className={buttonStyles.secondary}>
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
