'use client'

import {
  AppWindow,
  ArrowRight,
  Brain,
  Browser,
  CalendarCheck,
  ChatCircleDots,
  Clock,
  Cube,
  DeviceMobile,
  FlowArrow,
  Globe,
  Handshake,
  Headset,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Megaphone,
  Buildings,
  UserCircle,
  Signpost,
  Sparkle,
  Storefront,
  TelegramLogo,
  TiktokLogo,
  UsersThree,
  WhatsappLogo,
  YoutubeLogo,
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
  channelText,
  deliveryText,
  deliveryUi,
  faceUi,
  goalText,
  productIncludes,
  siteNeedText,
  siteNeedUi,
} from '@/content/builder-v2'
import {
  buildChannels,
  buildExtras,
  productParts,
  quote,
  type Build,
  type BuildChannel,
  type BuildExtra,
  type BusinessKind,
  type DeliveryChannel,
  type SiteNeed,
} from '@/lib/builder'
import { siteNeeds } from '@/lib/builder-ids'
import {
  deliveryOptions,
  effectiveDelivery,
  effectiveSiteNeed,
  goalsFor,
  hasAgent,
  visibleAddons,
  visibleExtras,
} from '@/lib/builder-v2'
import { Card } from '@/components/ui'
import { buttonStyles, cn } from '@/lib/cn'
import { extraPrices, formatUsd } from '@/lib/pricing'
import { usePricing } from './pricing-provider'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Choice, Group, Tick } from './builder-ui'
import { FlagshipOptions } from './builder-flagships'
import { flagshipPrice } from '@/lib/flagships'

const ease = [0.16, 1, 0.3, 1] as const

const productIcons: Record<ProductId, Icon> = {
  personal: UserCircle,
  company: Buildings,
  adminbot: CalendarCheck,
  intake: Headset,
  automation: FlowArrow,
  content: Sparkle,
  miniapp: DeviceMobile,
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

const channelIcons: Record<BuildChannel, Icon> = {
  instagram: InstagramLogo,
  telegram: TelegramLogo,
  search: MagnifyingGlass,
  word: UsersThree,
  maps: MapPin,
  tiktok: TiktokLogo,
  whatsapp: WhatsappLogo,
  youtube: YoutubeLogo,
  market: Storefront,
  ads: Megaphone,
  offline: Signpost,
  partners: Handshake,
}

const deliveryIcons: Record<DeliveryChannel, Icon> = {
  telegram: TelegramLogo,
  widget: Browser,
  whatsapp: WhatsappLogo,
  playground: Cube,
}

type Variants = Record<string, { name: string; term: string }>
type SetBuild = (update: (b: Build) => Build) => void

const toggle = <T,>(list: readonly T[] | undefined, id: T) =>
  list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

// ---------------------------------------------------------------- 1. niche

const popularKinds: readonly BusinessKind[] = ['salon', 'clinic', 'shop']
// How many niches of a category show before its own «ещё».
const perCategory = 3

function KindCard({
  id,
  locale,
  on,
  onPick,
  big,
}: {
  id: BusinessKind
  locale: string
  on: boolean
  onPick: (kind: BusinessKind) => void
  big?: boolean
}) {
  const entry = kindCatalog[id]
  const usual = entry.products.map((p) => pick(productCatalog[p].name, locale)).join(' + ')
  return (
    <Choice
      role="radio"
      on={on}
      onClick={() => onPick(id)}
      className={cn(
        'flex flex-col justify-between gap-3 p-3.5 sm:p-4',
        big ? 'min-h-[8.5rem] sm:min-h-[9.5rem]' : 'min-h-[7.5rem]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded-full border leading-none transition-colors',
          big ? 'size-11 text-2xl' : 'size-10 text-xl',
          on ? 'border-accent-text bg-accent/15' : 'border-line-strong',
        )}
      >
        {entry.emoji}
      </span>
      <span>
        <span className="block text-callout leading-tight font-medium">{kindName(id, locale)}</span>
        <span className="mt-1 hidden text-caption leading-snug text-faint sm:block">
          {id === 'other' ? pick(builderUi.kindOtherHint, locale) : usual}
        </span>
      </span>
    </Choice>
  )
}

// The first screen: what the builder is and what to expect, then three common niches in a row. «Ещё
// ниши» opens the full list by category, three per category with its own «ещё».
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
  const [all, setAll] = useState(() => Boolean(kind && !popularKinds.includes(kind)))
  const [open, setOpen] = useState<Set<KindCategory>>(() => new Set())
  const toggleCategory = (category: KindCategory) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  return (
    <>
      <h3 className="mb-4 text-callout font-medium">{pick(faceUi.nichesTitle, locale)}</h3>
      <div role="radiogroup" aria-label={pick(faceUi.popular, locale)} className="grid grid-cols-3 gap-2.5">
        {popularKinds.map((id) => (
          <KindCard key={id} id={id} locale={locale} on={kind === id} onPick={onPick} big />
        ))}
      </div>
      <button
        type="button"
        aria-expanded={all}
        onClick={() => setAll((v) => !v)}
        className={cn(buttonStyles.secondary, 'mt-4')}
      >
        {all ? pick(faceUi.lessNiches, locale) : pick(faceUi.more, locale)}
      </button>
      {all && (
        <div className="mt-8 grid gap-9">
          {kindsByCategory.map((group) => {
            const expanded = open.has(group.category)
            const rest = group.kinds.length - perCategory
            // A picked niche never hides behind a collapsed «ещё».
            const shown =
              expanded || rest <= 0
                ? group.kinds
                : group.kinds.filter((id, i) => i < perCategory || id === kind)
            return (
              <section key={group.category} aria-label={pick(categoryNames[group.category], locale)}>
                <h3 className="mb-3 text-caption text-faint font-medium">
                  {pick(categoryNames[group.category], locale)}
                </h3>
                <div
                  role="radiogroup"
                  aria-label={pick(categoryNames[group.category], locale)}
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {shown.map((id) => (
                    <KindCard key={id} id={id} locale={locale} on={kind === id} onPick={onPick} />
                  ))}
                  {rest > 0 && (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggleCategory(group.category)}
                      className="pressable min-h-[7.5rem] rounded-card border border-dashed border-line-strong p-4 text-callout text-muted hover:border-fg/40 hover:text-fg"
                    >
                      {expanded
                        ? pick(faceUi.lessInCategory, locale)
                        : `${pick(faceUi.moreInCategory, locale)} ${group.kinds.length - shown.length}`}
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <Link
        href={`/${locale}/solutions`}
        className="mt-9 inline-flex items-center gap-1.5 text-callout text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
      >
        {pick(ui.solutionsLinkAll, locale)}
        <ArrowRight size={14} className="shrink-0 text-accent-text" />
      </Link>
    </>
  )
}

// ------------------------------------------------------------- 2. products

// «Что делаем»: the product line (what the project does), never a place where it lives. A picked
// product pre-selects its parts; products with no price in pricing.ts say «по смете» and never reach
// the sum. When an agent is picked, one question follows: does it need a website?
export function ProductsStep({
  locale,
  build,
  onToggle,
  onSiteNeed,
  setBuild,
}: {
  locale: string
  build: Build
  onToggle: (id: ProductId) => void
  onSiteNeed: (need: SiteNeed) => void
  setBuild?: (update: (b: Build) => Build) => void
}) {
  const ui = builderUi
  const pricing = usePricing()
  const picked = build.products ?? []
  const need = effectiveSiteNeed(build)
  const noSite = need === 'no' || need === 'have'
  // «Telegram-бот» is a delivery channel now, not a product to choose; an old link may still carry it.
  const hidden = (id: ProductId) =>
    (id === 'bot' && !picked.includes(id)) || (id === 'site' && noSite && !picked.includes(id))
  const usual = (build.kind ? kindCatalog[build.kind].products : []).filter((id) => !hidden(id))
  const rest = productIds.filter((id) => !usual.includes(id) && !hidden(id))
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
            <h3 className="mb-4 text-caption text-faint font-medium">{section.title}</h3>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {section.ids.map((id) => {
              const entry = productCatalog[id]
              const Glyph = productIcons[id]
              const on = picked.includes(id)
              const from = entry.priced
                ? quote({ parts: productParts(id), extras: [] }, pricing).total
                : null
              // The flagships show their plan (setup + monthly): the Personal AI from its lowest level.
              const flagship =
                id === 'personal' || id === 'company'
                  ? flagshipPrice(id === 'personal' ? { ...build, options: { personal: ['mail'] } } : build, id, pricing).plan
                  : null
              return (
                <Choice key={id} on={on} onClick={() => onToggle(id)} className="flex gap-4 p-5">
                  <span
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-full border transition-colors',
                      on ? 'border-accent-text bg-accent text-accent-ink' : 'border-line-strong text-accent-text',
                    )}
                  >
                    <Glyph size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-body font-medium">{pick(entry.name, locale)}</span>
                      <span
                        className={cn(
                          'font-mono text-caption',
                          from === null && !flagship ? 'text-muted' : 'text-accent-text',
                        )}
                      >
                        {flagship
                          ? `${locale === 'ru' ? 'от' : 'from'} ${formatUsd(flagship.setup)} + ${formatUsd(flagship.monthly)}${locale === 'ru' ? '/мес' : '/mo'}`
                          : from === null
                            ? pick(ui.onRequest, locale)
                            : `${locale === 'ru' ? 'от' : 'from'} ${formatUsd(from)}`}
                      </span>
                    </span>
                    <span className="mt-1 block text-callout leading-snug text-muted">
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
      {setBuild &&
        (['personal', 'company'] as const)
          .filter((id) => picked.includes(id))
          .map((id) => <FlagshipOptions key={id} locale={locale} build={build} product={id} setBuild={setBuild} />)}
      {hasAgent(build) && (
        <Group title={pick(siteNeedUi.title, locale)} hint={pick(siteNeedUi.sub, locale)}>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={pick(siteNeedUi.title, locale)}>
            {siteNeeds.map((id) => {
              const on = need === id
              return (
                <Choice
                  key={id}
                  role="radio"
                  on={on}
                  onClick={() => onSiteNeed(id)}
                  className="flex items-start gap-3 rounded-tile p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-callout font-medium">{pick(siteNeedText[id].name, locale)}</span>
                    <span className="mt-1 block text-footnote leading-snug text-muted">
                      {pick(siteNeedText[id].hint, locale)}
                    </span>
                  </span>
                  <Tick on={on} />
                </Choice>
              )
            })}
          </div>
        </Group>
      )}
      <p className="text-footnote leading-relaxed text-faint">{pick(ui.onRequestNote, locale)}</p>
    </div>
  )
}

// ----------------------------------------------------------------- 3. goals

export function GoalsStep({
  locale,
  build,
  setBuild,
}: {
  locale: string
  build: Build
  setBuild: SetBuild
}) {
  const goals = goalsFor(build)
  return (
    <div className="grid gap-12">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((id) => {
          const text = goalText[id]
          if (!text) return null
          const on = Boolean(build.goals?.includes(id))
          return (
            <Choice
              key={id}
              on={on}
              onClick={() =>
                setBuild((b) => {
                  const next: Build = { ...b, goals: toggle(b.goals, id) }
                  if (!next.goals?.length) delete next.goals
                  return next
                })
              }
              className="flex gap-4 p-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{pick(text.name, locale)}</span>
                <span className="mt-1 block text-callout leading-snug text-muted">{pick(text.hint, locale)}</span>
              </span>
              <Tick on={on} />
            </Choice>
          )
        })}
      </div>
      <Group title={pick(faceUi.channelsTitle, locale)} hint={pick(builderUi.noPriceHint, locale)}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {buildChannels.map((id) => {
            const Glyph = channelIcons[id]
            const on = Boolean(build.channels?.includes(id))
            return (
              <Choice
                key={id}
                on={on}
                onClick={() =>
                  setBuild((b) => {
                    const next: Build = { ...b, channels: toggle(b.channels, id) }
                    if (!next.channels?.length) delete next.channels
                    return next
                  })
                }
                className="flex min-h-[5.5rem] flex-col gap-1.5 rounded-tile p-3.5"
              >
                <span className="flex items-center justify-between gap-2">
                  <Glyph size={20} weight={on ? 'fill' : 'regular'} className={on ? 'text-accent-text' : 'text-muted'} />
                  <Tick on={on} round={false} />
                </span>
                <span className="text-callout leading-tight font-medium">{pick(channelText[id].name, locale)}</span>
                <span className="text-caption leading-snug text-faint">{pick(channelText[id].hint, locale)}</span>
              </Choice>
            )
          })}
        </div>
      </Group>
    </div>
  )
}

// ------------------------------------------------------------------ 4. set

// «Состав»: what the picked products already include (pre-selected, explained), the format of each
// part, where an agent lives, and, tucked away at the bottom, separate parts to add.
export function SetStep({
  dict,
  locale,
  build,
  onToggle,
  onVariant,
  onDelivery,
}: {
  dict: Dict
  locale: string
  build: Build
  onToggle: (slug: ServiceSlug) => void
  onVariant: (slug: ServiceSlug, variant: string) => void
  onDelivery: (id: DeliveryChannel) => void
}) {
  const t = dict.builder
  const pricing = usePricing()
  const reduce = useReducedMotion()
  const [more, setMore] = useState(false)
  const picked = build.products ?? []
  const need = effectiveSiteNeed(build)
  const present = serviceSlugs.filter((slug) => build.parts[slug])
  // A part some picked product brings is never removed by hand: unpick the product instead.
  const owned = (slug: ServiceSlug) => picked.some((id) => productParts(id)[slug])
  // The flow never proposes a website once the client said no (or has one).
  const noSite = hasAgent(build) && (need === 'no' || need === 'have')
  const addable = serviceSlugs.filter((slug) => !build.parts[slug] && !(slug === 'websites' && noSite))
  const delivery = effectiveDelivery(build)
  return (
    <div className="grid gap-12">
      {picked.length > 0 && (
        <Group title={pick(faceUi.includedTitle, locale)} hint={pick(faceUi.includedNote, locale)}>
          <div className="grid gap-3 sm:grid-cols-2">
            {picked.map((id) => {
              const Glyph = productIcons[id]
              const lines = productIncludes[id]?.[locale === 'ru' ? 'ru' : 'en'] ?? []
              return (
                <div key={id} className="rounded-card border border-accent-text/50 bg-accent/[0.05] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-accent-text bg-accent text-accent-ink">
                      <Glyph size={18} />
                    </span>
                    <span className="text-body font-medium">{pick(productCatalog[id].name, locale)}</span>
                  </div>
                  <ul className="mt-3 grid gap-1.5 text-callout leading-snug text-muted">
                    {lines.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-text" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </Group>
      )}

      {present.length > 0 && (
        <Group title={t.formatTitle}>
          <div className="grid gap-4">
            {present.map((slug) => {
              const part = build.parts[slug]!
              const Glyph = serviceIcons[slug]
              const variants = dict.estimator.catalog[slug].variants as Variants
              const hints = t.variantHints[slug] as Record<string, string>
              return (
                <Card key={slug} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <Glyph size={20} className="text-accent-text" />
                      <span className="text-body font-medium">{dict.services.items[slug].name}</span>
                    </span>
                    {!owned(slug) && (
                      <button
                        type="button"
                        onClick={() => onToggle(slug)}
                        className="text-footnote text-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
                      >
                        {pick(builderUi.removePart, locale)}
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={dict.estimator.variant}>
                    {Object.entries(variants).map(([id, v]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={part.variant === id}
                        onClick={() => onVariant(slug, id)}
                        className={cn(
                          'pressable flex flex-col rounded-tile border border-hairline p-3.5 text-left',
                          part.variant === id ? 'border-accent-text bg-accent/[0.08]' : 'border-line hover:border-line-strong',
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-callout font-medium">{v.name}</span>
                          <span
                            className={cn(
                              'mt-0.5 size-3.5 shrink-0 rounded-full border',
                              part.variant === id
                                ? 'border-accent-text bg-accent shadow-[inset_0_0_0_3px_var(--color-bg)]'
                                : 'border-line-strong',
                            )}
                          />
                        </span>
                        <span className="mt-1 mb-3 block text-caption leading-snug text-muted">{hints[id]}</span>
                        <span className="mt-auto flex justify-between gap-2 text-caption text-faint">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {v.term}
                          </span>
                          <span className="font-mono text-fg">
                            {dict.services.from} {formatUsd(pricing.catalog[slug].variants[id] ?? 0)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </Group>
      )}

      {hasAgent(build) && (
        <Group title={pick(deliveryUi.title, locale)} hint={pick(deliveryUi.sub, locale)}>
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={pick(deliveryUi.title, locale)}>
            {deliveryOptions(build).map(({ id, disabled }) => {
              const Glyph = deliveryIcons[id]
              const on = delivery.includes(id)
              const text = deliveryText[id]
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => onDelivery(id)}
                  className={cn(
                    'pressable flex items-start gap-3.5 rounded-tile border border-hairline p-4 text-left disabled:cursor-not-allowed disabled:opacity-55',
                    on ? 'border-accent-text/70 bg-accent/[0.06]' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <Glyph size={22} className={cn('mt-0.5 shrink-0', on ? 'text-accent-text' : 'text-muted')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-callout font-medium">{pick(text.name, locale)}</span>
                    <span className="mt-1 block text-footnote leading-snug text-muted">{pick(text.hint, locale)}</span>
                  </span>
                  <Tick on={on} round={false} />
                </button>
              )
            })}
          </div>
          {need === 'no' && (
            <p className="mt-4 rounded-tile border border-hairline border-line bg-surface px-4 py-3 text-footnote leading-relaxed text-muted">
              {pick(deliveryUi.noSiteDiff, locale)}
            </p>
          )}
          {!delivery.length && <p className="mt-3 text-callout text-danger">{pick(deliveryUi.pickOne, locale)}</p>}
        </Group>
      )}

      {addable.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className={buttonStyles.secondary}
          >
            {more ? pick(faceUi.addPartsHide, locale) : pick(faceUi.addPartsOpen, locale)}
          </button>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.25, ease }}
                className="mt-5 grid gap-3 sm:grid-cols-2"
              >
                {addable.map((slug) => {
                  const Glyph = serviceIcons[slug]
                  return (
                    <Choice
                      key={slug}
                      on={false}
                      onClick={() => onToggle(slug)}
                      className="flex gap-4 p-5"
                    >
                      <Glyph size={22} className="mt-0.5 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium">{dict.services.items[slug].name}</span>
                          <span className="font-mono text-caption text-accent-text">
                            {dict.services.from} {formatUsd(pricing.startingPrice[slug])}
                          </span>
                        </span>
                        <span className="mt-1 block text-callout leading-snug text-muted">
                          {dict.services.items[slug].short}
                        </span>
                      </span>
                      <Tick on={false} />
                    </Choice>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {!picked.length && !present.length && <p className="text-callout text-danger">{t.pickOne}</p>}
    </div>
  )
}

// -------------------------------------------------------------- 5. features

export function FeaturesStep({
  dict,
  locale,
  build,
  onAddon,
  onExtra,
}: {
  dict: Dict
  locale: string
  build: Build
  onAddon: (slug: ServiceSlug, id: string) => void
  onExtra: (id: BuildExtra) => void
}) {
  const t = dict.builder
  const pricing = usePricing()
  const extraPrice = extraPrices(pricing)
  const groups = serviceSlugs
    .map((slug) => ({ slug, ids: visibleAddons(build, slug, pricing) }))
    .filter((g) => g.ids.length > 0)
  const extras = visibleExtras(build).filter((id) => (buildExtras as readonly string[]).includes(id))
  return (
    <div className="grid gap-10">
      {groups.map(({ slug, ids }) => {
        const part = build.parts[slug]!
        const names = dict.estimator.catalog[slug].addons as Record<string, string>
        const hints = t.addonHints[slug] as Record<string, string>
        const variant = (dict.estimator.catalog[slug].variants as Variants)[part.variant]
        return (
          <Group key={slug} title={dict.services.items[slug].name} hint={variant?.name}>
            <div className="grid gap-2 sm:grid-cols-2">
              {ids.map((id) => (
                <Option
                  key={id}
                  on={part.addons.includes(id)}
                  onClick={() => onAddon(slug, id)}
                  name={names[id] ?? id}
                  hint={hints[id] ?? ''}
                  price={`+${formatUsd(pricing.catalog[slug].addons[id] ?? 0)}`}
                />
              ))}
            </div>
          </Group>
        )
      })}
      {extras.length > 0 && (
        <Group title={t.extrasTitle}>
          <div className="grid gap-2 sm:grid-cols-2">
            {extras.map((id) => {
              const price = extraPrice[id]
              return (
                <Option
                  key={id}
                  on={build.extras.includes(id)}
                  onClick={() => onExtra(id)}
                  name={dict.extras.items[id].name}
                  hint={t.extraHints[id]}
                  price={
                    price.from === null ? '' : `+${formatUsd(price.from)}${price.monthly ? t.perMonth : ''}`
                  }
                />
              )
            })}
          </div>
        </Group>
      )}
      {groups.length === 0 && extras.length === 0 && (
        <p className="max-w-[58ch] text-muted">{pick(faceUi.featuresEmpty, locale)}</p>
      )}
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
    <Choice on={on} onClick={onClick} className="flex items-start gap-3.5 rounded-tile p-4">
      <Tick on={on} round={false} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-callout font-medium">{name}</span>
          <span className={cn('shrink-0 font-mono text-caption', on ? 'text-accent-text' : 'text-faint')}>
            {price}
          </span>
        </span>
        <span className="mt-1 block text-footnote leading-snug text-muted">{hint}</span>
      </span>
    </Choice>
  )
}
