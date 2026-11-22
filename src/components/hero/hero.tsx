import { ArrowRight, ChatCircleDots, Clock } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { productIds } from '@/lib/products'
import { ChatOpenButton } from '../chat/chat-open-button'
import { HeroIntro } from '../hero-intro'
import { KineticHeadline } from '../kinetic-headline'
import { GuaranteeLine } from '../guarantee-line'
import { Magnetic } from '../magnetic'
import { Badge } from '../ui/badge'
import { HeroSequence } from './hero-sequence'

// Home hero, stage B1 («сайт из будущего»): a huge kinetic headline over a 3D product stage, and a
// scroll sequence that brings the seven products forward one by one (HeroSequence). The headline,
// sub and buttons are server HTML animated in CSS, so the headline is the LCP and everything reads
// without JavaScript; the stage, captions and parallax are the client island.
// `cue` is scene one of the home film (Fira greets the visitor), shown above the buttons.
export function Hero({ locale, dict, cue }: { locale: Locale; dict: Dict; cue?: ReactNode }) {
  const h = dict.hero
  const products = productIds.map((id) => ({
    id,
    name: dict.products.items[id].name,
    benefit: dict.products.items[id].benefit,
  }))
  return (
    <HeroSequence
      locale={locale}
      products={products}
      demo={dict.products.demo}
      copy={h.sequence}
      concept={dict.products.concept}
      intro={
        <>
          <HeroIntro delay={0}>
            <p className="mb-5 text-callout font-medium text-accent-text">{h.eyebrow}</p>
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
          {cue ? <div className="mb-6">{cue}</div> : null}
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
              className={buttonStyles.glass}
            >
              <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
              {h.chatCta}
            </ChatOpenButton>
          </div>
          <p className="mt-4 text-footnote">
            <Link
              href={`/${locale}/ai-team`}
              data-cta="hero_team"
              className="inline-flex items-center gap-1.5 text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
            >
              {h.teamLink}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </p>
          {/* Go-live trust lines (owner 2026-11-21): the guarantee and the response promise on the first screen. */}
          <div className="mt-4 grid max-w-[46ch] gap-2 lg:max-w-[780px]" data-hero-promises>
            <GuaranteeLine dict={dict} locale={locale} className="text-footnote" />
            <p className="flex items-start gap-2.5 text-footnote text-muted">
              <Clock size={18} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
              <span>{dict.sla.line}</span>
            </p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 lg:hidden">
            {h.trust.map((item) => (
              <li key={item}>
                <Badge>{item}</Badge>
              </li>
            ))}
          </ul>
        </HeroIntro>
      }
    />
  )
}
