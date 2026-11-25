import { ArrowRight, ArrowUpRight, Check } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonClass, buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { fromLine } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { isFlagship, productAnchor, productBuilderHref, productIds, productPath, type ProductId } from '@/lib/products'
import { serviceSlugs } from '@/lib/site'
import Image from 'next/image'
import { displayH2, dotIcon, sectionTitle } from '../home-v5'
import { GlowBlob } from '@/components/ui'
import { Ladder } from '../ladder'
import { Reveal } from '../reveal'
import { SpotlightCard } from '../spotlight-card'
import { Badge } from '../ui/badge'
import { SectionHeader } from '../ui/section'
import { ProductDemo } from './product-demo'
import { ProductPriceTag } from './product-price'
import { productIcons } from './product-icons'

// Bento of the seven products (#products). lg: 12 columns, the two flagships first as 6+6 (owner
// 2026-11-22), then 4+4+4 and 6+6. Each card's demo replays on hover and focus.
const spans: Record<ProductId, string> = {
  personal: 'lg:col-span-6',
  company: 'lg:col-span-6',
  admin: 'lg:col-span-4',
  receptionist: 'lg:col-span-4',
  automation: 'lg:col-span-4',
  content: 'lg:col-span-6',
  miniapp: 'lg:col-span-6',
}

export async function ProductsBento({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = dict.products
  const pricing = await getPricing()
  return (
    <section id="products" className="relative mx-auto max-w-7xl px-4 py-section md:px-8">
      {/* Old links to /#services land here. */}
      <span id="services" className="absolute -top-24" aria-hidden="true" />
      <SectionHeader title={sectionTitle(t.title)} titleClassName={displayH2} lead={t.sub} />

      <ul className="mt-14 grid gap-gutter md:grid-cols-2 lg:grid-cols-12">
        {productIds.map((id, i) => (
          <li key={id} id={productAnchor(id)} className={cn('scroll-mt-28', spans[id])}>
            <Reveal className="h-full" delay={(i % 3) * 0.06}>
              <ProductCard id={id} locale={locale} dict={dict} />
            </Reveal>
          </li>
        ))}
      </ul>

      <Reveal className="mt-gutter">
        <div className="grid gap-6 rounded-card border border-hairline border-glass-highlight bg-elevated p-card shadow-card lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-4">
            <p className="font-display text-title-3 font-semibold">{t.classicTitle}</p>
            <p className="mt-2 text-muted">{t.classicSub}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-4">
            {serviceSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/${locale}/services/${slug}`}
                  className="pressable group flex h-full items-center justify-between gap-3 rounded-xl border border-hairline border-line bg-surface px-4 py-3 hover:border-accent-text/40 hover:bg-bg"
                >
                  <span>
                    <span className="block font-medium">{dict.services.items[slug].name}</span>
                    <span className="font-mono text-xs text-muted">
                      {fromLine(pricing.startingPrice[slug], 0, locale)}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-text"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <div id="levels" className="mt-section scroll-mt-24">
        <SectionHeader title={sectionTitle(dict.ladder.title)} titleClassName={displayH2} lead={dict.ladder.sub} />
        <div className="mt-10">
          <Ladder locale={locale} dict={dict} />
        </div>
      </div>

      <Reveal className="mt-gutter">
        <div
          data-departments-strip
          className="relative isolate flex flex-col gap-5 overflow-hidden rounded-card border border-hairline border-accent-text/25 bg-pine p-card lg:flex-row lg:items-center lg:justify-between"
        >
          <GlowBlob className="-top-24 -right-16 -z-10 size-72" />
          <div>
            <p className="font-display text-title-3 font-semibold">{dict.ladder.strip.title}</p>
            <p className="mt-2 max-w-[60ch] text-muted">{dict.ladder.strip.text}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/ai-team`} data-cta="products_departments" className={cn(buttonStyles.primary, 'group')}>
              {dict.ladder.strip.depts}
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link href={`/${locale}/ai-team#agents`} data-cta="products_agents" className={buttonStyles.secondary}>
              {dict.ladder.strip.agents}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function ProductCard({
  id,
  locale,
  dict,
}: {
  id: ProductId
  locale: Locale
  dict: Dict
}) {
  const t = dict.products
  const item = t.items[id]
  const Glyph = productIcons[id]
  const wide = false
  const flagship = isFlagship(id)
  return (
    <SpotlightCard
      className={cn(
        'group relative isolate h-full overflow-hidden rounded-card border border-hairline border-glass-highlight bg-material-regular shadow-[var(--shadow-glass)] backdrop-blur-xl transition-[border-color,transform,box-shadow] duration-300 ease-out-quint [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-card-hover',
        flagship ? 'hover:border-accent-text' : 'hover:border-line-strong',
      )}
    >
      <article
        className={cn('flex h-full flex-col', wide && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}
        aria-labelledby={`${productAnchor(id)}-name`}
      >
        <div
          className={cn(
            'dot-grid relative m-1.5 mb-0 grid min-h-[13.5rem] place-items-center overflow-hidden rounded-tile border border-hairline border-line bg-bg/60 px-5 py-6',
            wide && 'lg:order-2 lg:mb-2 lg:min-h-0',
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,var(--hero-glow),transparent)]" />
          <ProductDemo id={id} copy={t.demo} className="relative w-full max-w-[20rem]" />
          <span className="absolute right-3 bottom-2 text-caption text-faint">{t.concept}</span>
        </div>

        {/* v5: two tiles carry a visual, the rest keep the live mini-demo. */}
        {id === 'company' && <GlowBlob className="-bottom-24 -left-20 -z-10 size-72" />}
        {id === 'personal' && (
          <Image
            src="/fira/fira-glasses.jpg"
            alt=""
            width={96}
            height={96}
            sizes="96px"
            className="absolute right-4 bottom-4 hidden size-20 rounded-full object-cover shadow-[0_0_0_4px_var(--color-glass-strong),0_14px_40px_color-mix(in_srgb,var(--color-accent-text)_28%,transparent)] sm:block"
          />
        )}
        <div className="flex flex-1 flex-col gap-5 p-card">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-[14rem] flex-1 items-center gap-3">
              <span className={cn(dotIcon, 'size-10')}>
                <Glyph size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                {flagship && (
                  <Badge tone="accent" className="mb-1">{t.flagship}</Badge>
                )}
                <h3 id={`${productAnchor(id)}-name`} className="text-title-3 font-semibold break-words">
                  {item.name}
                </h3>
              </div>
            </div>
            <ProductPriceTag id={id} copy={t} locale={locale} className="shrink-0 sm:text-right" />
          </div>

          <p className="text-headline font-normal">{item.benefit}</p>
          {/* Scene four of the home film: Fira introduces each member of the team in one line. */}
          <p data-film-intro={id} className="-mt-2 flex gap-2 text-sm leading-snug text-muted">
            <span className="shrink-0 text-caption leading-5 font-semibold text-accent-text">{dict.film.team.label}</span>
            <span>{dict.film.team[id]}</span>
          </p>

          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs text-faint">{t.forWhom}</dt>
              <dd className="mt-1 text-muted">{item.forWhom}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">{t.inside}</dt>
              <dd>
                <ul className="mt-1.5 grid gap-1.5">
                  {item.inside.map((line) => (
                    <li key={line} className="flex gap-2 text-muted">
                      <Check size={14} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                      {line}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          <div className="relative z-10 mt-auto flex flex-wrap items-center gap-x-3 gap-y-3 pt-1">
            <Link
              href={productBuilderHref(locale, id)}
              data-cta={`product_${id}`}
              className={buttonClass('primary', 'sm')}
            >
              {t.build}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link
              href={`/${locale}${productPath(id)}`}
              data-cta={`product_more_${id}`}
              className={buttonClass('secondary', 'sm')}
            >
              {t.more}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>
    </SpotlightCard>
  )
}
