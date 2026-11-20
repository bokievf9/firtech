import { ArrowRight, Check } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { getPricing } from '@/lib/pricing-store'
import type { ServiceSlug } from '@/lib/site'
import { Estimator } from './estimator'
import { GuaranteeLine } from './guarantee-line'
import { Reveal } from './reveal'

// Prices (#pricing): the calculator; on the home page (`teaser`) also the builder teaser and the
// payment line (folded in from the old regions block). The bundle discount comes from pricing.ts.
export async function PricingSection({
  dict,
  locale,
  initialService,
  teaser = false,
}: {
  dict: Dict
  locale: string
  initialService?: ServiceSlug
  teaser?: boolean
}) {
  const t = dict.estimator
  const h = dict.pricingHome
  const pricing = await getPricing()
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-section md:px-8">
      <div className={cn('grid gap-gutter', teaser && 'lg:grid-cols-12 lg:items-stretch')}>
        <Reveal className={cn(teaser && 'lg:col-span-7 lg:self-center')}>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h2 className="mt-4 font-display text-title font-semibold">{t.title}</h2>
          <p className="mt-5 max-w-[48ch] text-lead text-muted">{t.sub}</p>
          {teaser && (
            <p className="mt-6 text-sm text-faint">
              {h.currency}. {h.stages} {dict.region.payTitle}: {dict.region.pay.join(', ')}.
            </p>
          )}
          <GuaranteeLine dict={dict} locale={locale} className="mt-5 max-w-[52ch]" />
          <Link
            href={`/${locale}/compare`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
          >
            {h.compareLink}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Reveal>
        {teaser && (
          <Reveal delay={0.08} className="lg:col-span-5">
            <div className="relative h-full overflow-hidden rounded-card border border-accent-text/30 bg-[linear-gradient(150deg,var(--color-pine),var(--color-surface)_70%)] p-6 md:p-8">
              <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
              <div className="relative">
                <p className="font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase">
                  {h.builderEyebrow}
                </p>
                <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{h.builderTitle}</p>
                <p className="mt-3 leading-relaxed text-muted">{h.builderText}</p>
                <ul className="mt-5 grid gap-2 text-sm">
                  {[h.bundle.replace('{n}', String(Math.round(pricing.bundleDiscount))), h.pdf, h.link].map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <Check size={14} weight="bold" aria-hidden="true" className="text-accent-text" />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/builder`}
                  data-cta="pricing_builder"
                  className={cn(buttonStyles.primary, 'group mt-7')}
                >
                  {h.builderCta}
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </Reveal>
        )}
      </div>
      <Reveal className="mt-12">
        <Estimator dict={dict} locale={locale} initialService={initialService} />
      </Reveal>
    </section>
  )
}
