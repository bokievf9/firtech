import { ArrowRight, ChatCircleDots, Clock } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { productIds } from '@/lib/product-ids'
import { ChatOpenButton } from '../chat/chat-open-button'
import { HeroIntro } from '../hero-intro'
import { KineticHeadline } from '../kinetic-headline'
import { GuaranteeLine } from '../guarantee-line'
import { Magnetic } from '../magnetic'
import { Badge } from '../ui/badge'
import { HeroOrbit } from './hero-orbit'

// Home hero (owner 2026-11-26): the living 3D Fira in the centre, the seven products orbiting her on an
// inclined ring (HeroOrbit, client island). The whole section fills the viewport on desktop. The headline,
// sub, buttons and facts are server HTML animated in CSS, so the headline is the LCP and the page reads
// without JavaScript. `facts` is the row of short promises under the buttons.
export function Hero({ locale, dict, facts }: { locale: Locale; dict: Dict; facts?: string[] }) {
  const h = dict.hero
  const items = facts ?? h.trust
  const products = productIds.map((id) => ({
    id,
    name: dict.products.items[id].name,
    benefit: dict.products.items[id].benefit,
  }))
  return (
    <section data-hero className="relative flex flex-col justify-center overflow-x-clip px-5 pt-24 pb-10 sm:px-8 lg:min-h-[100dvh] lg:pt-28 lg:pb-8">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,min(44vw,660px))] lg:gap-8 xl:gap-14">
        <div className="min-w-0">
          <HeroIntro delay={0}>
            <p className="mb-5 text-callout font-medium text-accent-text">{h.eyebrow}</p>
          </HeroIntro>
          <KineticHeadline
            title={h.title}
            lines={h.lines}
            accent={1}
            className="hero-display font-display font-semibold [font-variation-settings:'SHRP'_60] lg:!text-[clamp(2.6rem,3.9vw,4.8rem)]"
          />
          <HeroIntro delay={0.55}>
            <p className="mt-6 max-w-[46ch] text-lead text-muted">{h.sub}</p>
          </HeroIntro>
          <HeroIntro delay={0.64}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Magnetic>
                <Link href={`/${locale}/builder`} data-cta="hero_builder" className={cn(buttonStyles.primary, 'group w-full sm:w-auto')}>
                  {h.primary}
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Magnetic>
              <ChatOpenButton source="hero" fallbackHref="#demo" className={buttonStyles.glass}>
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
                {h.chatCta}
              </ChatOpenButton>
            </div>
            {/* Go-live trust lines (owner 2026-11-21): the guarantee and the response promise on the first screen. */}
            <div className="mt-5 grid max-w-[46ch] gap-2" data-hero-promises>
              <GuaranteeLine dict={dict} locale={locale} className="text-footnote" short />
              <p className="flex items-start gap-2.5 text-footnote text-muted">
                <Clock size={18} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                <span>{dict.sla.short}</span>
              </p>
            </div>
            <ul data-hero-facts className="mt-5 flex flex-wrap gap-2">
              {items.filter(Boolean).map((item) => (
                <li key={item}>
                  <Badge>{item}</Badge>
                </li>
              ))}
            </ul>
          </HeroIntro>
        </div>
        <HeroOrbit locale={locale} products={products} label={dict.film.name} ring={dict.products.eyebrow} />
      </div>
    </section>
  )
}
