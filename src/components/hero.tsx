import { ArrowDown, ArrowRight, Key, Receipt, Stack, TelegramLogo } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { telegramUrl } from '@/lib/site'
import { HeroIntro } from './hero-intro'
import { HeroLines } from './hero-lines'
import { HeroPicker } from './hero-picker'
import { HeroStage } from './hero-stage'
import { Magnetic } from './magnetic'

const trustIcons = [Receipt, Stack, Key]

export function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  const h = dict.hero
  return (
    <section className="relative overflow-hidden">
      <HeroStage
        tilt={false}
        copy={
          <>
            <h1 className="font-brand text-[clamp(1.85rem,3.05vw,3rem)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
              <span className="sr-only">{h.title}</span>
              <HeroLines lines={h.lines} accent={1} />
            </h1>
            <HeroIntro delay={0.5}>
              <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-muted md:text-xl">
                {h.sub}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic>
                  <Link
                    href={`/${locale}/builder`}
                    className={`${buttonStyles.primary} group w-full sm:w-auto`}
                  >
                    {h.primary}
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                </Magnetic>
                {telegramUrl ? (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-place="hero"
                    className={buttonStyles.secondary}
                  >
                    <TelegramLogo
                      size={18}
                      weight="fill"
                      aria-hidden="true"
                      className="text-[#5cc4f5]"
                    />
                    {h.telegram}
                  </a>
                ) : (
                  <Link href={homeAnchor(locale, 'contact')} className={buttonStyles.secondary}>
                    {dict.nav.cta}
                  </Link>
                )}
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
                {h.trust.map((item, i) => {
                  const Glyph = trustIcons[i] ?? Receipt
                  return (
                    <li key={item} className="flex items-center gap-2">
                      <Glyph size={17} aria-hidden="true" className="text-accent" />
                      {item}
                    </li>
                  )
                })}
              </ul>
            </HeroIntro>
          </>
        }
        demo={<HeroPicker locale={locale} dict={dict} />}
        footer={
          <a
            href="#services"
            className={cn(
              'absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs text-faint transition-colors hover:text-fg lg:flex',
            )}
          >
            {h.scroll}
            <ArrowDown size={14} aria-hidden="true" className="motion-safe:animate-bounce" />
          </a>
        }
      />
    </section>
  )
}
