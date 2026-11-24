import { ArrowRight, Check } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { getPricing } from '@/lib/pricing-store'
import { GlowBlob } from './hero/_v5-stubs' // v5 stub: replaced by ui exports on merge
import { displayH2, limeButton, sectionTitle } from './home-v5'
import { GuaranteeLine } from './guarantee-line'
import { Reveal } from './reveal'

// Prices (#pricing) on the home page (owner 2026-11-22: the builder replaced the estimator): the builder
// teaser and the payment line. The bundle discount comes from pricing.ts.
export async function PricingSection({ dict, locale }: { dict: Dict; locale: string }) {
  const h = dict.pricingHome
  const pricing = await getPricing()
  return (
    <section id="pricing" data-fira-react="pricing" className="mx-auto max-w-7xl px-4 py-section md:px-8">
      <div className={'grid gap-gutter lg:grid-cols-12 lg:items-stretch'}>
        <Reveal className={'lg:col-span-7 lg:self-center'}>
          <p className="mb-4 text-footnote font-medium text-accent-text">{h.eyebrow}</p>
          <h2 className={displayH2}>{sectionTitle(h.title)}</h2>
          <p className="mt-5 max-w-[48ch] text-lead text-muted">{h.sub}</p>
          <p className="mt-6 text-footnote text-faint">
            {h.currency}. {h.stages} {dict.region.payTitle}: {dict.region.pay.join(', ')}.
          </p>
          <GuaranteeLine dict={dict} locale={locale} className="mt-5 max-w-[52ch]" />
          <Link
            href={`/${locale}/compare`}
            className="mt-4 inline-flex items-center gap-1.5 text-callout text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
          >
            {h.compareLink}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Reveal>
        <Reveal delay={0.08} className="lg:col-span-5">
          <div className="relative isolate h-full overflow-hidden rounded-card border border-hairline border-glass-highlight bg-surface p-sheet shadow-card">
            <GlowBlob className="-top-28 -right-24 -z-10 size-80" />
            <div
              aria-hidden="true"
              className="dot-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]"
            />
            <div className="relative">
              <p className="text-footnote font-semibold text-accent-text">{h.builderEyebrow}</p>
              <p className="mt-3 font-display text-title-2 font-semibold">{h.builderTitle}</p>
              <p className="mt-3 text-body text-muted">{h.builderText}</p>
              <ul className="mt-5 grid gap-2 text-callout">
                {[
                  h.bundle.replace('{n}', String(Math.round(pricing.bundleDiscount))),
                  h.pdf,
                  h.link,
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <Check
                      size={14}
                      weight="bold"
                      aria-hidden="true"
                      className="text-accent-text"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/builder`}
                data-cta="pricing_builder"
                className={cn(limeButton, 'group mt-7')}
              >
                {h.builderCta}
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
