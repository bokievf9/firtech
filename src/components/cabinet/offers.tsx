import Link from 'next/link'
import { GuaranteeLine } from '@/components/guarantee-line'
import { ProductPriceTag } from '@/components/products/product-price'
import type { Dict } from '@/content'
import { cabinetRefLink, formatDate, type CabinetData } from '@/lib/cabinet-data'
import { tabCounts, withTab } from '@/lib/cabinet-tabs'
import { buttonStyles, cn } from '@/lib/cn'
import type { Offer, OfferArticle, OfferPlan } from '@/lib/cabinet-offers'
import type { Locale } from '@/lib/i18n'
import { fillReferralPercent } from '@/lib/referral'
import { CopyLink } from './cabinet-forms'
import { OfferLink } from './offer-link'
import { fill } from './ui'

// Offers inside the cabinet (owner 2026-11-21: «больше промоушена»). Server components; only the
// link (offer-link.tsx) is a client island, to count clicks. Cards use the card tokens, a small
// «Предложение» label and one CTA each. Prices come from pricing.ts through ProductPriceTag.
const card = 'flex flex-col rounded-card border border-line bg-surface p-5 md:p-6'
const tag = 'font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase'

function OfferCard({ offer, dict }: { offer: Offer; dict: Dict }) {
  const o = dict.cabinet.offers
  if (offer.kind === 'product' && offer.product) {
    const item = dict.products.items[offer.product]
    return (
      <li className={card} data-offer-card={offer.id}>
        <p className={tag}>{o.label}</p>
        <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">{item.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{item.benefit}</p>
        <ProductPriceTag id={offer.product} copy={dict.products} className="mt-4" />
        <OfferLink href={offer.href} offer={offer.id} className={cn(buttonStyles.secondary, 'mt-5 self-start')}>
          {o.build}
        </OfferLink>
      </li>
    )
  }
  const copy = offer.kind === 'audit' ? o.audit : o.second
  return (
    <li className={card} data-offer-card={offer.id}>
      <p className={tag}>{o.label}</p>
      <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">{copy.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.text}</p>
      <OfferLink href={offer.href} offer={offer.id} className={cn(buttonStyles.secondary, 'mt-5 self-start')}>
        {copy.cta}
      </OfferLink>
    </li>
  )
}

function Cards({ offers, dict }: { offers: Offer[]; dict: Dict }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} dict={dict} />
      ))}
    </ul>
  )
}

// The slim strip at the bottom of the tabs other than «Обзор».
export function OffersStrip({ plan, dict }: { plan: OfferPlan; dict: Dict }) {
  return (
    <aside aria-label={dict.cabinet.offers.stripTitle} className="mt-6 border-t border-line pt-8" data-offers-strip>
      <h2 className="font-display text-lg font-semibold tracking-tight">{dict.cabinet.offers.stripTitle}</h2>
      <div className="mt-4">
        <Cards offers={plan.strip} dict={dict} />
      </div>
    </aside>
  )
}

// The «Обзор» tab: what needs attention, the offers for the visitor's state, the referral link,
// the guarantee, the latest articles and the status page.
export function Overview({
  data,
  plan,
  dict,
  locale,
  articles,
}: {
  data: CabinetData
  plan: OfferPlan
  dict: Dict
  locale: Locale
  articles: OfferArticle[]
}) {
  const o = dict.cabinet.offers
  const counts = tabCounts(data)
  const items = [
    counts.leads ? { tab: 'leads' as const, text: fill(o.openLeads, { n: String(counts.leads) }) } : null,
    counts.invoices ? { tab: 'invoices' as const, text: fill(o.unpaid, { n: String(counts.invoices) }) } : null,
    counts.support ? { tab: 'support' as const, text: fill(o.openTickets, { n: String(counts.support) }) } : null,
  ].filter((v) => v !== null)
  const title = plan.stage === 'start' ? o.startTitle : plan.stage === 'waiting' ? o.waitingTitle : o.growTitle
  const sub = plan.stage === 'start' ? o.startSub : plan.stage === 'waiting' ? o.waitingSub : o.growSub
  const link = cabinetRefLink(locale, data.referralSlug)

  return (
    <>
      <section aria-labelledby="cabinet-attention-title" data-cabinet-attention>
        <h2 id="cabinet-attention-title" className="font-display text-xl font-semibold tracking-tight">
          {o.attentionTitle}
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{o.allClear}</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-3">
            {items.map((item) => (
              <li key={item.tab}>
                <Link
                  href={withTab('', item.tab)}
                  scroll={false}
                  className="inline-flex rounded-full border border-line-strong px-4 py-2 text-sm text-fg transition-colors hover:border-accent-text hover:text-accent-text"
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cabinet-offers-title" data-cabinet-offers={plan.stage}>
        <h2 id="cabinet-offers-title" className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">{sub}</p>
        <div className="mt-5">
          <Cards offers={plan.cards} dict={dict} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="cabinet-ref-title">
          <p className={tag}>{o.label}</p>
          <h2 id="cabinet-ref-title" className="mt-3 font-display text-lg font-semibold tracking-tight">
            {o.referral.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{fillReferralPercent(o.referral.text)}</p>
          {link && (
            <div className="mt-4">
              <CopyLink link={link} dict={dict} />
            </div>
          )}
          <OfferLink
            href={`/${locale}/referral`}
            offer="referral"
            className="mt-4 self-start text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
          >
            {o.referral.cta}
          </OfferLink>
        </section>

        <section className={card} aria-labelledby="cabinet-status-title">
          <h2 id="cabinet-status-title" className="font-display text-lg font-semibold tracking-tight">
            {o.status.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{o.status.text}</p>
          <OfferLink href={`/${locale}/status`} offer="status" className={cn(buttonStyles.secondary, 'mt-5 self-start')}>
            {o.status.cta}
          </OfferLink>
          <GuaranteeLine dict={dict} locale={locale} className="mt-6 border-t border-line pt-5" />
        </section>
      </div>

      {articles.length > 0 && (
        <section aria-labelledby="cabinet-blog-title" data-cabinet-blog>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="cabinet-blog-title" className="font-display text-xl font-semibold tracking-tight">
              {o.blogTitle}
            </h2>
            <Link
              href={`/${locale}/blog`}
              className="text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
            >
              {o.blogAll}
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/${locale}/blog/${a.slug}`}
                  className="block h-full rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                >
                  <span className="font-mono text-[12px] text-faint">{formatDate(a.date, locale)}</span>
                  <span className="mt-2 block text-[15px] leading-snug font-medium text-balance">{a.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
