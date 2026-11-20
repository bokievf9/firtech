import { ArrowRight, ArrowUpRight, Check } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { demoPlace, demoSalonUrl } from '@/lib/demo'
import type { Locale } from '@/lib/i18n'
import { formatUsd, startingPrice } from '@/lib/pricing'
import { productAnchor, productBuilderHref, productIds, type ProductId } from '@/lib/products'
import { serviceSlugs } from '@/lib/site'
import { ChatOpenButton } from '../chat/chat-open-button'
import { DirectionCta } from '../direction-cta'
import { Reveal } from '../reveal'
import { SpotlightCard } from '../spotlight-card'
import { ProductDemo } from './product-demo'
import { ProductPriceTag } from './product-price'
import { productIcons } from './product-icons'

// Bento of the seven products (#products). lg: 12 columns, rows 7+5, 4+4+4, 6+6; from 1920 the
// rows become 6+3+3 and 3+3+3+3 (four across). Each card's demo replays on hover and focus.
const spans: Record<ProductId, string> = {
  admin: 'md:col-span-2 lg:col-span-7 min-[1920px]:col-span-6',
  receptionist: 'lg:col-span-5 min-[1920px]:col-span-3',
  automation: 'lg:col-span-4 min-[1920px]:col-span-3',
  content: 'lg:col-span-4 min-[1920px]:col-span-3',
  miniapp: 'lg:col-span-4 min-[1920px]:col-span-3',
  agent: 'lg:col-span-6 min-[1920px]:col-span-3',
  implementation: 'lg:col-span-6 min-[1920px]:col-span-3',
}

export function ProductsBento({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = dict.products
  return (
    <section id="products" className="relative mx-auto max-w-7xl px-4 py-section md:px-8">
      {/* Old links to /#services land here. */}
      <span id="services" className="absolute -top-24" aria-hidden="true" />
      <div className="grid items-end gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h2 className="mt-4 font-display text-title font-semibold">{t.title}</h2>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-5">
          <p className="max-w-[48ch] text-lead text-muted">{t.sub}</p>
        </Reveal>
      </div>

      <ul className="mt-14 grid gap-gutter md:grid-cols-2 lg:grid-cols-12">
        {productIds.map((id, i) => (
          <li key={id} id={productAnchor(id)} className={cn('scroll-mt-28', spans[id])}>
            <Reveal className="h-full" delay={(i % 3) * 0.06}>
              <ProductCard id={id} index={i} locale={locale} dict={dict} />
            </Reveal>
          </li>
        ))}
      </ul>

      <Reveal className="mt-gutter">
        <div className="grid gap-6 rounded-card border border-line p-6 md:p-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-4">
            <p className="font-display text-2xl font-semibold tracking-tight">{t.classicTitle}</p>
            <p className="mt-2 text-muted">{t.classicSub}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-4">
            {serviceSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/${locale}/services/${slug}`}
                  className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
                >
                  <span>
                    <span className="block font-medium">{dict.services.items[slug].name}</span>
                    <span className="font-mono text-xs text-muted">
                      {t.from} {formatUsd(startingPrice[slug])}
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
    </section>
  )
}

function ProductCard({
  id,
  index,
  locale,
  dict,
}: {
  id: ProductId
  index: number
  locale: Locale
  dict: Dict
}) {
  const t = dict.products
  const item = t.items[id]
  const Glyph = productIcons[id]
  const wide = id === 'admin'
  return (
    <SpotlightCard className="group h-full rounded-card border border-line bg-surface transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong">
      <article
        className={cn('flex h-full flex-col', wide && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}
        aria-labelledby={`${productAnchor(id)}-name`}
      >
        <div
          className={cn(
            'dot-grid relative m-2 mb-0 grid min-h-[13.5rem] place-items-center overflow-hidden rounded-[14px] border border-line bg-bg/60 px-5 py-6',
            wide && 'lg:order-2 lg:mb-2 lg:min-h-0',
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,var(--hero-glow),transparent)]" />
          <ProductDemo id={id} copy={t.demo} className="relative w-full max-w-[20rem]" />
          <span className="absolute right-3 bottom-2 font-mono text-[10px] text-faint">{t.concept}</span>
        </div>

        <div className="flex flex-1 flex-col gap-5 p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-strong text-accent-text">
                <Glyph size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-faint">
                  {String(index + 1).padStart(2, '0')}
                  {wide && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-accent-text">
                      {t.flagship}
                    </span>
                  )}
                </p>
                <h3 id={`${productAnchor(id)}-name`} className="text-xl font-semibold tracking-tight md:text-2xl">
                  {item.name}
                </h3>
              </div>
            </div>
            <ProductPriceTag id={id} copy={t} className="shrink-0 text-right" />
          </div>

          <p className="text-lg leading-snug">{item.benefit}</p>

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

          <div className="relative z-10 mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
            <Link
              href={productBuilderHref(locale, id)}
              data-cta={`product_${id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-[background-color,transform] duration-300 ease-out-expo hover:bg-accent-strong active:scale-[0.98]"
            >
              {t.build}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            {id === 'receptionist' ? (
              <ChatOpenButton
                source="product"
                fallbackHref="#demo"
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-accent-text"
              >
                {dict.demoSection.cta}
                <ArrowUpRight size={14} aria-hidden="true" />
              </ChatOpenButton>
            ) : (
              <DirectionCta id={id} label={t.discuss} variant="link" />
            )}
            {(id === 'admin' || id === 'miniapp') && (
              <a
                href={demoSalonUrl}
                data-place={`${demoPlace}_${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent-text"
              >
                {id === 'admin' ? dict.demoStand.tryDemo : dict.demoStand.botDemo}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </article>
    </SpotlightCard>
  )
}
