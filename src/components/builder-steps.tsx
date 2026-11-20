'use client'

import {
  AppWindow,
  ArrowRight,
  Brain,
  CalendarCheck,
  ChatCircleDots,
  Clock,
  DeviceMobile,
  FlowArrow,
  Globe,
  Headset,
  InstagramLogo,
  MagnifyingGlass,
  Megaphone,
  PhoneCall,
  Robot,
  ShoppingCart,
  Sparkle,
  TelegramLogo,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import type { Dict } from '@/content'
import {
  builderUi,
  categoryNames,
  kindCatalog,
  kindName,
  kindsByCategory,
  pick,
  productCatalog,
  productIds,
  type KindCategory,
  type ProductId,
} from '@/content/builder-catalog'
import {
  buildChannels,
  buildExtras,
  buildGoals,
  productParts,
  quote,
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

const productIcons: Record<ProductId, Icon> = {
  adminbot: CalendarCheck,
  intake: Headset,
  automation: FlowArrow,
  content: Sparkle,
  miniapp: DeviceMobile,
  agent: Robot,
  aiteam: Brain,
  site: Globe,
  bot: TelegramLogo,
  app: AppWindow,
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
  locale,
  kind,
  onPick,
}: {
  locale: string
  kind: BusinessKind | null
  onPick: (kind: BusinessKind) => void
}) {
  const ui = builderUi
  const [filter, setFilter] = useState<KindCategory | 'all'>('all')
  const groups = kindsByCategory.filter((g) => filter === 'all' || g.category === filter)
  return (
    <>
      <div
        role="tablist"
        aria-label={pick(ui.kindTitle, locale)}
        className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {(['all', ...kindsByCategory.map((g) => g.category)] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              'min-h-10 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap transition-colors duration-200',
              filter === id
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line-strong text-muted hover:border-fg/40 hover:text-fg',
            )}
          >
            {id === 'all' ? pick(ui.kindFilterAll, locale) : pick(categoryNames[id], locale)}
          </button>
        ))}
      </div>
      <div className="grid gap-10">
        {groups.map((group) => (
          <section key={group.category} aria-label={pick(categoryNames[group.category], locale)}>
            {filter === 'all' && (
              <h3 className="mb-4 text-xs tracking-[0.14em] text-faint uppercase">
                {pick(categoryNames[group.category], locale)}
              </h3>
            )}
            <div
              role="radiogroup"
              aria-label={pick(categoryNames[group.category], locale)}
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
            >
              {group.kinds.map((id) => {
                const entry = kindCatalog[id]
                const on = kind === id
                const usual = entry.products
                  .map((p) => pick(productCatalog[p].name, locale))
                  .join(' + ')
                return (
                  <Choice
                    key={id}
                    role="radio"
                    on={on}
                    onClick={() => onPick(id)}
                    className="flex min-h-[7.5rem] flex-col justify-between gap-3 p-4"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-10 place-items-center rounded-full border text-xl leading-none transition-colors',
                        on ? 'border-accent bg-accent/15' : 'border-line-strong',
                      )}
                    >
                      {entry.emoji}
                    </span>
                    <span>
                      <span className="block text-[15px] leading-tight font-medium">
                        {kindName(id, locale)}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-faint">
                        {id === 'other' ? pick(ui.kindOtherHint, locale) : usual}
                      </span>
                    </span>
                  </Choice>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <Link
        href={`/${locale}/solutions`}
        className="mt-9 inline-flex items-center gap-1.5 text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
      >
        {pick(ui.solutionsLinkAll, locale)}
        <ArrowRight size={14} className="shrink-0 text-accent" />
      </Link>
    </>
  )
}

// "What are we building": the product line. A picked product pre-selects its parts and options;
// products with no price in pricing.ts say "on quote" and never reach the sum.
export function ProductsStep({
  locale,
  build,
  onToggle,
}: {
  locale: string
  build: Build
  onToggle: (id: ProductId) => void
}) {
  const ui = builderUi
  const picked = build.products ?? []
  const usual = build.kind ? kindCatalog[build.kind].products : []
  const rest = productIds.filter((id) => !usual.includes(id))
  const sections = [
    ...(usual.length && build.kind
      ? [
          {
            id: 'usual',
            title: `${pick(ui.productsRecommendedFor, locale)}: ${kindName(build.kind, locale).toLowerCase()}`,
            ids: [...usual],
          },
        ]
      : []),
    { id: 'rest', title: usual.length ? pick(ui.productsMore, locale) : '', ids: rest },
  ]
  return (
    <div className="grid gap-10">
      {sections.map((section) => (
        <section key={section.id}>
          {section.title && (
            <h3 className="mb-4 text-xs tracking-[0.14em] text-faint uppercase">{section.title}</h3>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {section.ids.map((id) => {
              const entry = productCatalog[id]
              const Glyph = productIcons[id]
              const on = picked.includes(id)
              const from = entry.priced
                ? quote({ parts: productParts(id), extras: [] }).total
                : null
              return (
                <Choice key={id} on={on} onClick={() => onToggle(id)} className="flex gap-4 p-5">
                  <span
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-full border transition-colors',
                      on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-accent',
                    )}
                  >
                    <Glyph size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[16px] font-medium">{pick(entry.name, locale)}</span>
                      <span
                        className={cn(
                          'font-mono text-xs',
                          from === null ? 'text-muted' : 'text-accent',
                        )}
                      >
                        {from === null
                          ? pick(ui.onRequest, locale)
                          : `${locale === 'ru' ? 'от' : 'from'} ${formatUsd(from)}`}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted">
                      {pick(entry.hint, locale)}
                    </span>
                  </span>
                  <Tick on={on} />
                </Choice>
              )
            })}
          </div>
        </section>
      ))}
      <p className="text-[13px] leading-relaxed text-faint">{pick(ui.onRequestNote, locale)}</p>
    </div>
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
