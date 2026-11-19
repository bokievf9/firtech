import { ArrowRight, ChatCircleDots } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { productIds } from '@/lib/products'
import { ChatOpenButton } from '../chat/chat-open-button'
import { HeroIntro } from '../hero-intro'
import { KineticHeadline } from '../kinetic-headline'
import { Magnetic } from '../magnetic'
import { HeroSequence } from './hero-sequence'

// Home hero, stage B1 («сайт из будущего»): a huge kinetic headline over a 3D product stage, and a
// scroll sequence that brings the seven products forward one by one (HeroSequence). The headline,
// sub and buttons are server HTML animated in CSS, so the headline is the LCP and everything reads
// without JavaScript; the stage, captions and parallax are the client island.
export function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  const h = dict.hero
  const products = productIds.map((id) => ({
    id,
    name: dict.products.items[id].name,
    benefit: dict.products.items[id].benefit,
  }))
  return (
    <HeroSequence
      products={products}
      demo={dict.products.demo}
      copy={h.sequence}
      concept={dict.products.concept}
      intro={
        <>
          <HeroIntro delay={0}>
            <p className="mb-6 flex items-center gap-2.5 font-mono text-xs tracking-[0.16em] text-muted uppercase">
              <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
              {h.eyebrow}
            </p>
          </HeroIntro>
          <KineticHeadline
            title={h.title}
            lines={h.lines}
            accent={1}
            className="hero-display font-display font-semibold [font-variation-settings:'SHRP'_60]"
          />
        </>
      }
      sub={
        <HeroIntro delay={0.55}>
          <p className="max-w-[46ch] text-lead text-muted">{h.sub}</p>
        </HeroIntro>
      }
      actions={
        <HeroIntro delay={0.64}>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Magnetic>
              <Link
                href={`/${locale}/builder`}
                data-cta="hero_builder"
                className={cn(buttonStyles.primary, 'group w-full sm:w-auto')}
              >
                {h.primary}
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </Magnetic>
            <ChatOpenButton
              source="hero"
              fallbackHref="#demo"
              className={cn(buttonStyles.secondary, 'glass')}
            >
              <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent" />
              {h.chatCta}
            </ChatOpenButton>
          </div>
          <p className="mt-4 text-[13px]">
            <Link
              href={`/${locale}/audit`}
              data-cta="hero_audit"
              className="inline-flex items-center gap-1.5 text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              {h.auditLink}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-faint lg:hidden">
            {h.trust.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-accent/70" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </HeroIntro>
      }
    />
  )
}
