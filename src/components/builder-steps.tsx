'use client'

import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ChatCircleDots,
  Clock,
  Coffee,
  DeviceMobile,
  DotsThreeOutline,
  FlowArrow,
  Globe,
  InstagramLogo,
  MagnifyingGlass,
  Megaphone,
  Moped,
  PhoneCall,
  Robot,
  Scissors,
  ShoppingCart,
  Storefront,
  TelegramLogo,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import type { Dict } from '@/content'
import {
  buildChannels,
  buildExtras,
  buildGoals,
  businessKinds,
  presets,
  type Build,
  type BuildChannel,
  type BuildExtra,
  type BuildGoal,
  type BusinessKind,
} from '@/lib/builder'
import { cn } from '@/lib/cn'
import { catalog, extraPrice, formatUsd, startingPrice } from '@/lib/pricing'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Choice, Group, Pill, Tick } from './builder-ui'

const ease = [0.16, 1, 0.3, 1] as const

export const kindIcons: Record<BusinessKind, Icon> = {
  cafe: Coffee,
  salon: Scissors,
  shop: Storefront,
  delivery: Moped,
  services: Briefcase,
  other: DotsThreeOutline,
}

export const serviceIcons: Record<ServiceSlug, Icon> = {
  websites: Globe,
  bots: ChatCircleDots,
  apps: DeviceMobile,
  automation: FlowArrow,
}

const goalIcons: Record<BuildGoal, Icon> = {
  leads: PhoneCall,
  sales: ShoppingCart,
  booking: CalendarCheck,
  routine: Robot,
  brand: Megaphone,
}

const channelIcons: Record<BuildChannel, Icon> = {
  instagram: InstagramLogo,
  telegram: TelegramLogo,
  search: MagnifyingGlass,
  word: UsersThree,
}

type Variants = Record<string, { name: string; term: string }>

const toggle = <T,>(list: readonly T[] | undefined, id: T) =>
  list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

export function KindStep({
  dict,
  locale,
  kind,
  onPick,
}: {
  dict: Dict
  locale: string
  kind: BusinessKind | null
  onPick: (kind: BusinessKind) => void
}) {
  const t = dict.builder
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {businessKinds.map((id) => {
          const Glyph = kindIcons[id]
          const parts = serviceSlugs
            .filter((slug) => presets[id].parts[slug])
            .map((slug) => dict.services.items[slug].name)
          return (
            <Choice
              key={id}
              role="radio"
              on={kind === id}
              onClick={() => onPick(id)}
              className="flex min-h-40 flex-col justify-between gap-6 p-5 md:min-h-48 md:p-6"
            >
              <span className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'grid size-12 place-items-center rounded-full border transition-colors',
                    kind === id
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line-strong text-accent',
                  )}
                >
                  <Glyph size={22} />
                </span>
                <ArrowRight
                  size={16}
                  className="mt-1 text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </span>
              <span>
                <span className="block text-[17px] leading-tight font-medium md:text-lg">
                  {t.kinds[id]}
                </span>
                <span className="mt-1.5 block min-h-[1lh] text-[13px] leading-snug text-faint">
                  {id === 'other' ? t.kindOther : parts.join(' + ')}
                </span>
              </span>
            </Choice>
          )
        })}
      </div>
      <Link
        href={`/${locale}/solutions`}
        className="mt-7 inline-flex items-center gap-1.5 text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
      >
        {dict.solutions.builderLink}
        <ArrowRight size={14} className="shrink-0 text-accent" />
      </Link>
    </>
  )
}

export function GoalsStep({
  dict,
  build,
  setBuild,
}: {
  dict: Dict
  build: Build
  setBuild: (update: (b: Build) => Build) => void
}) {
  const t = dict.builder
  return (
    <div className="grid gap-12">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {buildGoals.map((id) => {
          const Glyph = goalIcons[id]
          const on = Boolean(build.goals?.includes(id))
          return (
            <Choice
              key={id}
              on={on}
              onClick={() =>
                setBuild((b) => {
                  const goals = toggle(b.goals, id)
                  const next: Build = { ...b, goals }
                  if (!goals.length) delete next.goals
                  return next
                })
              }
              className="flex gap-4 p-5"
            >
              <Glyph size={24} className={cn('mt-0.5 shrink-0', on ? 'text-accent' : 'text-muted')} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.goals[id].name}</span>
                <span className="mt-1 block text-sm leading-snug text-muted">
                  {t.goals[id].hint}
                </span>
              </span>
              <Tick on={on} />
            </Choice>
          )
        })}
      </div>
      <Group title={t.channelsTitle} hint={t.noPrice}>
        <div className="flex flex-wrap gap-2">
          {buildChannels.map((id) => {
            const Glyph = channelIcons[id]
            const on = Boolean(build.channels?.includes(id))
            return (
              <Pill
                key={id}
                on={on}
                icon={<Glyph size={16} weight={on ? 'fill' : 'regular'} />}
                onClick={() =>
                  setBuild((b) => {
                    const channels = toggle(b.channels, id)
                    const next: Build = { ...b, channels }
                    if (!channels.length) delete next.channels
                    return next
                  })
                }
              >
                {t.channels[id]}
              </Pill>
            )
          })}
        </div>
      </Group>
    </div>
  )
}

export function PartsStep({
  dict,
  build,
  onToggle,
  onVariant,
}: {
  dict: Dict
  build: Build
  onToggle: (slug: ServiceSlug) => void
  onVariant: (slug: ServiceSlug, variant: string) => void
}) {
  const t = dict.builder
  const reduce = useReducedMotion()
  const hasParts = Object.keys(build.parts).length > 0
  return (
    <>
      <div className="grid gap-3">
        {serviceSlugs.map((slug) => {
          const part = build.parts[slug]
          const Glyph = serviceIcons[slug]
          const variants = dict.estimator.catalog[slug].variants as Variants
          const terms = Object.values(variants).map((v) => v.term)
          const hints = t.variantHints[slug] as Record<string, string>
          return (
            <div
              key={slug}
              className={cn(
                'rounded-card border transition-colors duration-300',
                part ? 'border-accent/60 bg-accent/[0.04]' : 'border-line bg-surface',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={Boolean(part)}
                onClick={() => onToggle(slug)}
                className="flex w-full items-start gap-4 p-5 text-left md:p-6"
              >
                <span
                  className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-full border transition-colors',
                    part ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-muted',
                  )}
                >
                  <Glyph size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-lg font-medium">{dict.services.items[slug].name}</span>
                    <span className="font-mono text-sm text-accent">
                      {dict.services.from} {formatUsd(startingPrice[slug])}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-muted">
                    {dict.services.items[slug].short}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-faint">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} />
                      {part ? variants[part.variant]?.term : `${dict.services.from} ${terms[0]}`}
                    </span>
                    <span>{dict.services.items[slug].tags.join(' · ')}</span>
                  </span>
                </span>
                <Tick on={Boolean(part)} />
              </button>
              <AnimatePresence initial={false}>
                {part && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 md:px-6 md:pb-6">
                      <p className="mb-3 text-xs tracking-[0.12em] text-faint uppercase">
                        {t.formatTitle}
                      </p>
                      <div
                        className="grid gap-2 sm:grid-cols-3"
                        role="radiogroup"
                        aria-label={dict.estimator.variant}
                      >
                        {Object.entries(variants).map(([id, v]) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={part.variant === id}
                            onClick={() => onVariant(slug, id)}
                            className={cn(
                              'flex flex-col rounded-xl border p-3.5 text-left transition-colors duration-200',
                              part.variant === id
                                ? 'border-accent bg-accent/[0.08]'
                                : 'border-line hover:border-line-strong',
                            )}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium">{v.name}</span>
                              <span
                                className={cn(
                                  'mt-0.5 size-3.5 shrink-0 rounded-full border',
                                  part.variant === id
                                    ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg)]'
                                    : 'border-line-strong',
                                )}
                              />
                            </span>
                            <span className="mt-1 mb-3 block text-xs leading-snug text-muted">
                              {hints[id]}
                            </span>
                            <span className="mt-auto flex justify-between gap-2 text-xs text-faint">
                              {v.term}
                              <span className="font-mono text-fg">
                                {dict.services.from} {formatUsd(catalog[slug].variants[id] ?? 0)}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      {!hasParts && <p className="mt-5 text-sm text-danger">{t.pickOne}</p>}
    </>
  )
}

export function FeaturesStep({
  dict,
  build,
  onAddon,
  onExtra,
}: {
  dict: Dict
  build: Build
  onAddon: (slug: ServiceSlug, id: string) => void
  onExtra: (id: BuildExtra) => void
}) {
  const t = dict.builder
  return (
    <div className="grid gap-10">
      {serviceSlugs.map((slug) => {
        const part = build.parts[slug]
        if (!part) return null
        const names = dict.estimator.catalog[slug].addons as Record<string, string>
        const hints = t.addonHints[slug] as Record<string, string>
        const variant = (dict.estimator.catalog[slug].variants as Variants)[part.variant]
        return (
          <Group
            key={slug}
            title={dict.services.items[slug].name}
            hint={variant?.name}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(names).map(([id, name]) => (
                <Option
                  key={id}
                  on={part.addons.includes(id)}
                  onClick={() => onAddon(slug, id)}
                  name={name}
                  hint={hints[id] ?? ''}
                  price={`+${formatUsd(catalog[slug].addons[id] ?? 0)}`}
                />
              ))}
            </div>
          </Group>
        )
      })}
      <Group title={t.extrasTitle}>
        <div className="grid gap-2 sm:grid-cols-2">
          {buildExtras.map((id) => {
            const price = extraPrice[id]
            return (
              <Option
                key={id}
                on={build.extras.includes(id)}
                onClick={() => onExtra(id)}
                name={dict.extras.items[id].name}
                hint={t.extraHints[id]}
                price={
                  price.from === null
                    ? ''
                    : `+${formatUsd(price.from)}${price.monthly ? t.perMonth : ''}`
                }
              />
            )
          })}
        </div>
      </Group>
    </div>
  )
}

function Option({
  on,
  onClick,
  name,
  hint,
  price,
}: {
  on: boolean
  onClick: () => void
  name: string
  hint: string
  price: string
}) {
  return (
    <Choice on={on} onClick={onClick} className="flex items-start gap-3.5 rounded-xl p-4">
      <Tick on={on} round={false} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium">{name}</span>
          <span className={cn('shrink-0 font-mono text-xs', on ? 'text-accent' : 'text-faint')}>
            {price}
          </span>
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-muted">{hint}</span>
      </span>
    </Choice>
  )
}
