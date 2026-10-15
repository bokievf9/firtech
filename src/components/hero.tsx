import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { HeroIntro } from './hero-intro'
import { LeadFlowDemo } from './lead-flow-demo'

export function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <section className="relative overflow-hidden">
      {/* Soft pine light behind the demo; static, no glow on interactive elements. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] h-[640px] w-[760px] rounded-full bg-[radial-gradient(closest-side,rgb(181_235_106/0.10),transparent)]"
      />
      <div className="relative mx-auto grid min-h-[100dvh] max-w-7xl items-center gap-12 px-4 pt-28 pb-16 md:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-24">
        <HeroIntro className="lg:col-span-7">
          <h1 className="max-w-[16ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl lg:text-[4.1rem]">
            {dict.hero.title}
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted md:text-xl">
            {dict.hero.sub}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={homeAnchor(locale, 'contact')} className={buttonStyles.primary}>
              {dict.nav.cta}
            </Link>
            <Link href={homeAnchor(locale, 'pricing')} className={buttonStyles.secondary}>
              {dict.hero.secondary}
            </Link>
          </div>
        </HeroIntro>
        <div className="lg:col-span-5">
          <LeadFlowDemo t={dict.hero.demo} />
        </div>
      </div>
    </section>
  )
}
