import {
  ArrowUpRight,
  Browser,
  ChartBar,
  DeviceMobile,
  Lightning,
  Robot,
  TelegramLogo,
  Table,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { formatUsd, startingPrice } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { BotChatDemo } from './bot-chat-demo'
import { Reveal } from './reveal'

export function Services({ locale, dict }: { locale: Locale; dict: Dict }) {
  const s = dict.services
  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
      <Reveal>
        <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{s.title}</h2>
        <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-muted">{s.sub}</p>
      </Reveal>

      <div className="mt-14 grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Card locale={locale} dict={dict} slug="websites" className="dot-grid">
            <div className="flex items-end gap-3 pt-6">
              <Browser size={56} weight="thin" className="text-accent" />
              <span className="pb-1 text-sm text-faint">{s.items.websites.tags.join(' / ')}</span>
            </div>
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
            <div className="flex gap-3 pt-6">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'flex h-24 w-14 items-center justify-center rounded-[14px] border border-line-strong bg-bg/40',
                    i === 1 && '-translate-y-3 border-accent/40',
                  )}
                >
                  <DeviceMobile size={22} weight="light" className={i === 1 ? 'text-accent' : 'text-faint'} />
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.08}>
          <Card locale={locale} dict={dict} slug="automation">
            <FlowChips site={dict.hero.demo.site} />
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
    <article
      className={cn(
        'group relative flex h-full flex-col justify-between gap-8 rounded-card border border-line bg-surface p-6 transition-colors duration-300 hover:border-line-strong md:p-8',
        className,
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-2xl font-semibold tracking-tight md:text-[1.7rem]">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {item.name}
            </Link>
          </h3>
          <p className="shrink-0 pt-1 font-mono text-sm text-muted">
            {dict.services.from} <span className="text-lg text-accent">{formatUsd(startingPrice[slug])}</span>
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
        <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </article>
  )
}

function FlowChips({ site }: { site: string }) {
  const steps = [
    { icon: Browser, label: site },
    { icon: TelegramLogo, label: 'Telegram' },
    { icon: Robot, label: 'AI' },
    { icon: Table, label: 'CRM' },
    { icon: ChartBar, label: 'Sheets' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map(({ icon: Icon, label }, i) => (
        <span key={label} className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-bg/50 px-3.5 py-2 text-sm">
            <Icon size={16} className="text-accent" />
            {label}
          </span>
          {i < steps.length - 1 && <Lightning size={12} weight="fill" className="text-faint" />}
        </span>
      ))}
    </div>
  )
}
