import { ProductPriceTag } from '@/components/products/product-price'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Offer, OfferPlan } from '@/lib/cabinet-offers'
import { OfferLink } from './offer-link'

// Offers inside the cabinet (owner 2026-11-21: «больше промоушена»; v3 2026-11-22: smaller, the project
// comes first). A slim strip at the bottom of every tab: two compact cards, a small «Предложение» label,
// one CTA each. Server components; only the link (offer-link.tsx) is a client island, to count clicks.
// Prices come from pricing.ts through ProductPriceTag, never typed.
const card = 'flex flex-col rounded-xl border border-line bg-surface p-4'
const tag = 'font-mono text-[10px] tracking-[0.14em] text-accent-text uppercase'
const cta = cn(buttonStyles.secondary, 'mt-3 self-start !px-4 !py-2 text-sm')

function OfferCard({ offer, dict }: { offer: Offer; dict: Dict }) {
  const o = dict.cabinet.offers
  if (offer.kind === 'product' && offer.product) {
    const item = dict.products.items[offer.product]
    return (
      <li className={card} data-offer-card={offer.id}>
        <p className={tag}>{o.label}</p>
        <h3 className="mt-2 text-base font-semibold tracking-tight">{item.name}</h3>
        <ProductPriceTag id={offer.product} copy={dict.products} className="mt-2" />
        <OfferLink href={offer.href} offer={offer.id} className={cta}>
          {o.build}
        </OfferLink>
      </li>
    )
  }
  const copy = offer.kind === 'audit' ? o.audit : o.second
  return (
    <li className={card} data-offer-card={offer.id}>
      <p className={tag}>{o.label}</p>
      <h3 className="mt-2 text-base font-semibold tracking-tight">{copy.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{copy.text}</p>
      <OfferLink href={offer.href} offer={offer.id} className={cta}>
        {copy.cta}
      </OfferLink>
    </li>
  )
}

export function OffersStrip({ plan, dict }: { plan: OfferPlan; dict: Dict }) {
  return (
    <aside aria-label={dict.cabinet.offers.stripTitle} className="mt-4 border-t border-line pt-6" data-offers-strip>
      <h2 className="text-sm font-medium text-muted">{dict.cabinet.offers.stripTitle}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {plan.strip.map((offer) => (
          <OfferCard key={offer.id} offer={offer} dict={dict} />
        ))}
      </ul>
    </aside>
  )
}
