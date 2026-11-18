import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  CalendarCheck,
  DeviceMobile,
  FlowArrow,
  Globe,
  GraduationCap,
  Headset,
  Newspaper,
  UserCircle,
} from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import Link from 'next/link'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import {
  directionIds,
  directionPage,
  directionPrices,
  type DirectionId,
} from '@/lib/directions'
import type { Locale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { DirectionCta } from './direction-cta'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'
import { SpotlightCard } from './spotlight-card'

const icons: Record<DirectionId, Icon> = {
  admin: CalendarCheck,
  receptionist: Headset,
  automation: FlowArrow,
  content: Newspaper,
  miniapp: DeviceMobile,
  agent: UserCircle,
  implementation: Brain,
  training: GraduationCap,
  site: Globe,
}

// Eight cards in two columns with alternating widths, websites as a full-width ninth card.
// lg: two per row, the last full width. >= 1920px: three per row with shifting widths.
const spans = [
  'lg:col-span-7 min-[1920px]:col-span-5',
  'lg:col-span-5 min-[1920px]:col-span-4',
  'lg:col-span-5 min-[1920px]:col-span-3',
  'lg:col-span-7 min-[1920px]:col-span-3',
  'lg:col-span-7 min-[1920px]:col-span-5',
  'lg:col-span-5 min-[1920px]:col-span-4',
  'lg:col-span-5 min-[1920px]:col-span-4',
  'lg:col-span-7 min-[1920px]:col-span-3',
  'lg:col-span-12 min-[1920px]:col-span-5',
]

export function Directions({ locale, dict }: { locale: Locale; dict: Dict }) {
  const d = dict.directions
  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
      <RiseText text={d.title} className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl" />
      <Reveal delay={0.15}>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{d.sub}</p>
      </Reveal>

      <div className="mt-14 grid gap-4 lg:grid-cols-12 min-[1920px]:gap-5">
        {directionIds.map((id, i) => (
          <Reveal key={id} className={spans[i]} delay={(i % 2) * 0.08}>
            <Card id={id} index={i} locale={locale} dict={dict} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Price({ id, dict }: { id: DirectionId; dict: Dict }) {
  const d = dict.directions
  const price = directionPrices[id]
  const unit =
    price.unit === 'month' ? d.perMonth : price.unit === 'person' ? d.perPerson : undefined
  return (
    <div className="shrink-0 text-right font-mono text-sm text-muted">
      <p>
        {d.from} <span className="text-lg text-accent-text">{formatUsd(price.from)}</span>
        {unit && <span className="ml-1.5 text-xs">{unit}</span>}
      </p>
      {price.team && (
        <p className="mt-0.5 text-xs">
          <span className="text-fg">{formatUsd(price.team)}</span> {d.team}
        </p>
      )}
      {price.supportMonthly && (
        <p className="mt-0.5 text-xs">
          + <span className="text-fg">{formatUsd(price.supportMonthly)}</span> {d.support}
        </p>
      )}
    </div>
  )
}

function Card({
  id,
  index,
  locale,
  dict,
}: {
  id: DirectionId
  index: number
  locale: Locale
  dict: Dict
}) {
  const d = dict.directions
  const item = d.items[id]
  const Glyph = icons[id]
  const page = directionPage[id]
  const wide = index === directionIds.length - 1
  return (
    <SpotlightCard
      className={cn(
        'group flex h-full flex-col justify-between gap-7 rounded-card border border-line bg-surface p-6 transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong md:p-8',
        index % 4 === 0 && 'dot-grid',
        index === 5 && 'bg-[linear-gradient(160deg,var(--color-pine)_0%,var(--color-surface)_70%)]',
      )}
    >
      <article id={`dir-${id}`} className="contents">
        <div className={cn(wide && 'lg:grid lg:grid-cols-2 lg:gap-12 min-[1920px]:block')}>
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-strong text-accent-text">
                  <Glyph size={22} aria-hidden="true" />
                </span>
                <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{item.title}</h3>
              </div>
              <Price id={id} dict={dict} />
            </div>
            <div className="mt-4 grid max-w-[52ch] gap-2 leading-relaxed text-muted">
              {item.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <dl className={cn('mt-6 grid gap-3 text-sm', wide && 'lg:mt-0 lg:content-center')}>
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <dt className="text-xs text-faint">{d.before}</dt>
              <dd className="mt-1 text-muted">{item.before}</dd>
            </div>
            <div className="rounded-xl border border-accent/30 bg-bg/50 p-4">
              <dt className="flex items-center gap-1.5 text-xs text-accent-text">
                <ArrowRight size={12} aria-hidden="true" />
                {d.after}
              </dt>
              <dd className="mt-1 text-fg">{item.after}</dd>
            </div>
          </dl>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <DirectionCta id={id} label={d.discuss} />
          {page && (
            <Link
              href={`/${locale}/services/${page}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-fg transition-colors hover:text-accent-text"
            >
              {d.more}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </article>
    </SpotlightCard>
  )
}
