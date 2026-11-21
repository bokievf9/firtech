import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { HeroIntro } from '../hero-intro'

// What every cabinet page shows while Supabase is not configured.
export function CabinetSoon({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = dict.cabinet.soon
  return (
    <section className="mx-auto max-w-3xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h1 className="mt-5 text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
          {t.title}
        </h1>
        <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted">{t.text}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/${locale}/builder`} className={buttonStyles.primary}>
            {t.contact}
          </Link>
          <Link href={`/${locale}`} className={cn(buttonStyles.secondary)}>
            {t.home}
          </Link>
        </div>
      </HeroIntro>
    </section>
  )
}
