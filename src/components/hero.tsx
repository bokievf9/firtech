import { ArrowRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { HeroHeadline } from './hero-headline'
import { HeroIntro } from './hero-intro'
import { HeroStage } from './hero-stage'
import { LeadFlowDemo } from './lead-flow-demo'
import { Magnetic } from './magnetic'

export function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  const h = dict.hero
  return (
    <section className="relative overflow-hidden">
      <HeroStage
        copy={
          <>
            <HeroHeadline title={h.title} lead={h.lead} words={h.words} tail={h.tail} />
            <HeroIntro delay={0.45}>
              <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-muted md:text-xl">
                {h.sub}
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic>
                  <Link
                    href={homeAnchor(locale, 'contact')}
                    className={`${buttonStyles.primary} group w-full sm:w-auto`}
                  >
                    {dict.nav.cta}
                    <ArrowRight
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                </Magnetic>
                <Link href={homeAnchor(locale, 'pricing')} className={buttonStyles.secondary}>
                  {h.secondary}
                </Link>
              </div>
            </HeroIntro>
          </>
        }
        demo={<LeadFlowDemo t={h.demo} />}
      />
    </section>
  )
}
