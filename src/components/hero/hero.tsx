import { ArrowRight, ChatCircleDots } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { channelName, publicChannels } from '@/lib/channels'
import { guaranteeLine } from '@/lib/guarantee'
import type { Locale } from '@/lib/i18n'
import { getPricing } from '@/lib/pricing-store'
import { productIds } from '@/lib/product-ids'
import { ChatOpenButton } from '../chat/chat-open-button'
import { HeroIntro } from '../hero-intro'
import { KineticHeadline } from '../kinetic-headline'
import { Magnetic } from '../magnetic'
import { HeroOrbit } from './hero-orbit'

// Home hero (owner 2026-11-26): the living 3D Fira in the centre, the seven products orbiting her on an
// inclined ring (HeroOrbit, client island). The section fills the viewport on desktop. The headline, the
// tagline, the buttons and the facts are server HTML animated in CSS, so the headline is the LCP and the
// page reads without JavaScript. Copy is the AI-native wave of 2026-11-25 (titleLight/titleStrong, tagline);
// `cue` is scene one of the home film (Fira greets the visitor), shown above the buttons.
export async function Hero({ locale, dict, cue }: { locale: Locale; dict: Dict; cue?: ReactNode }) {
  const h = dict.hero
  const pricing = await getPricing()
  const channels = publicChannels(['telegram', 'whatsapp', 'web', 'email'] as const)
    .map((c) => channelName(c, locale))
    .join(', ')
  // Three facts: the guarantee line already names the launch term, so no separate «start in N days» line.
  const facts = [channels, guaranteeLine(dict, locale, pricing, 'short'), Object.values(dict.builder.langs).join(', ')]
  const products = productIds.map((id) => ({
    id,
    name: dict.products.items[id].name,
    benefit: dict.products.items[id].benefit,
  }))
  return (
    <section id="top" data-hero className="relative flex flex-col justify-center overflow-x-clip px-5 pt-24 pb-10 sm:px-8 lg:min-h-[100dvh] lg:pt-28 lg:pb-8">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,min(44vw,660px))] lg:gap-8 xl:gap-14">
        <div className="min-w-0">
          {cue ? (
            <HeroIntro delay={0}>
              <div className="mb-6" data-hero-cue data-fira-quiet="">
                {cue}
              </div>
            </HeroIntro>
          ) : null}
          <KineticHeadline
            title={`${h.titleLight} ${h.titleStrong}`}
            lines={[h.titleLight, h.titleStrong]}
            accent={1}
            className="hero-display font-display font-semibold [font-variation-settings:'SHRP'_60] lg:!text-[clamp(2.6rem,3.9vw,4.8rem)]"
          />
          <HeroIntro delay={0.55}>
            <p className="mt-6 max-w-[46ch] text-lead text-muted">{h.tagline}</p>
          </HeroIntro>
          <HeroIntro delay={0.64}>
            <div data-fira-quiet="" className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Magnetic>
                <Link href={`/${locale}/builder`} data-cta="hero_builder" className={cn(buttonStyles.primary, 'group w-full sm:w-auto')}>
                  {h.primary}
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Magnetic>
              <ChatOpenButton source="hero" fallbackHref="#demo" className={buttonStyles.glass}>
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
                {h.askFira}
              </ChatOpenButton>
            </div>
            <Link href={`/${locale}/ai-team`} data-cta="hero_team" className="mt-4 inline-flex items-center gap-1.5 text-footnote font-medium text-accent-text underline-offset-4 hover:underline">
              {h.teamLink}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <ul data-hero-facts className="mt-6 flex max-w-[52ch] flex-wrap gap-x-5 gap-y-2 border-t border-accent-text/15 pt-4 text-footnote font-medium text-muted">
              {facts.filter(Boolean).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </HeroIntro>
        </div>
        <HeroOrbit locale={locale} products={products} label={dict.film.name} ring={dict.products.eyebrow} />
      </div>
    </section>
  )
}
