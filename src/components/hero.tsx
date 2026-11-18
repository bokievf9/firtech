import { ArrowRight, ChatCircleDots } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { ChatOpenButton } from './chat/chat-open-button'
import { HeroIntro } from './hero-intro'
import { KineticHeadline } from './kinetic-headline'
import { HeroField } from './live/hero-field'
import { HeroLive } from './live/hero-live'
import { Magnetic } from './magnetic'

// Home hero «Живая компания» (stage A, docs/site-design-notes.md). Server component: the headline,
// text and buttons are in the HTML and animate in CSS (LCP is the headline). Client islands: the
// WebGL backdrop (lazy, capable devices only) and the live office window with its status line.
// The primary button keeps going to the builder; the secondary one opens the receptionist chat.
export function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  const h = dict.hero
  return (
    <section className="relative isolate overflow-hidden">
      <HeroField />
      {/* The copy sits in the page container; the live window spans the viewport (full bleed with
          gutters), so on 1920 and 2560 screens the office fills the width at 4x. */}
      <div className="relative flex min-h-[100dvh] flex-col justify-center gap-10 pt-28 pb-16 lg:gap-12 lg:pt-28">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <KineticHeadline
            title={h.title}
            lines={h.lines}
            accent={1}
            className="max-w-[15ch] font-display text-display font-semibold text-balance [font-variation-settings:'SHRP'_60] lg:max-w-none"
          />
          <div className="mt-8 grid items-end gap-7 lg:grid-cols-12 lg:gap-8">
            <HeroIntro delay={0.55} className="lg:col-span-6">
              <p className="max-w-[44ch] text-lead text-muted">{h.sub}</p>
            </HeroIntro>
            <HeroIntro delay={0.64} className="lg:col-span-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
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
                  <ChatCircleDots
                    size={18}
                    weight="fill"
                    aria-hidden="true"
                    className="text-accent"
                  />
                  {h.chatCta}
                </ChatOpenButton>
              </div>
            </HeroIntro>
          </div>
        </div>
        <HeroIntro delay={0.8} className="w-full px-4 md:px-8 min-[1920px]:px-12">
          <HeroLive locale={locale} copy={h.live} />
        </HeroIntro>
      </div>
      <div
        aria-hidden="true"
        className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 h-24"
      />
    </section>
  )
}
