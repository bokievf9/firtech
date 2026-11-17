import { ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { formatUsd, startingPrice } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { BotChatDemo } from './bot-chat-demo'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'
import { FlowChain, PhoneFan, SiteAssembly } from './service-visuals'
import { SpotlightCard } from './spotlight-card'

export function Services({ locale, dict }: { locale: Locale; dict: Dict }) {
  const s = dict.services
  const landing = dict.estimator.catalog.websites.variants.landing
  return (
    <section id="base" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
      <RiseText text={s.title} className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl" />
      <Reveal delay={0.15}>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{s.sub}</p>
      </Reveal>

      <div className="mt-14 grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Card locale={locale} dict={dict} slug="websites" className="dot-grid">
            <SiteAssembly term={landing.term} label={landing.name} />
          </Card>
        </Reveal>
        <Reveal className="lg:col-span-5" delay={0.08}>
          <Card locale={locale} dict={dict} slug="bots">
            <div className="rounded-2xl border border-line bg-bg/50 p-4">
              <BotChatDemo t={s.chat} />
            </div>
          </Card>
        </Reveal>
        <Reveal className="lg:col-span-5">
          <Card
            locale={locale}
            dict={dict}
            slug="apps"
            className="bg-[linear-gradient(160deg,var(--color-pine)_0%,var(--color-surface)_70%)]"
          >
            <PhoneFan />
          </Card>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.08}>
          <Card locale={locale} dict={dict} slug="automation">
            <FlowChain site={dict.hero.demo.site} />
          </Card>
        </Reveal>
      </div>
    </section>
  )
}

function Card({
  locale,
  dict,
  slug,
  className,
  children,
}: {
  locale: Locale
  dict: Dict
  slug: ServiceSlug
  className?: string
  children: ReactNode
}) {
  const item = dict.services.items[slug]
  const href = `/${locale}/services/${slug}`
  return (
    <SpotlightCard
      className={cn(
        'group flex h-full flex-col justify-between gap-8 rounded-card border border-line bg-surface p-6 transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong md:p-8',
        className,
      )}
    >
      <article className="contents">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight md:text-[1.7rem]">
              <Link
                href={href}
                className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
              >
                {item.name}
              </Link>
            </h3>
            <p className="shrink-0 pt-1 font-mono text-sm text-muted">
              {dict.services.from}{' '}
              <span className="text-lg text-accent">{formatUsd(startingPrice[slug])}</span>
            </p>
          </div>
          <p className="mt-3 max-w-[48ch] leading-relaxed text-muted">{item.short}</p>
        </div>
        <div className="relative z-10">{children}</div>
        <Link
          href={href}
          className="relative z-10 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-fg transition-colors hover:text-accent"
        >
          {dict.services.more}
          <ArrowUpRight
            size={14}
            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
      </article>
    </SpotlightCard>
  )
}
