'use client'

import {
  ArrowRight,
  Bell,
  BookOpen,
  Brain,
  CalendarCheck,
  CheckCircle,
  CreditCard,
  Lifebuoy,
  MapPin,
  PencilSimple,
  Robot,
  Sparkle,
  TelegramLogo,
  UserCircle,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import {
  builderUi,
  kindCatalog,
  kindName,
  pick,
  previewCopy,
  productCatalog,
  type PreviewCopy,
  type KindMock,
} from '@/content/builder-catalog'
import type { Build, BuildStyle } from '@/lib/builder'
import { styleVars } from '@/lib/builder-style'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// Style hooks (variables set by styleVars): heading face, border width and the mood's shadow.
const HEAD = 'pv-head [font-family:var(--pv-head-font)] [font-stretch:var(--pv-stretch)]'
const BORDER = 'border [border-width:var(--pv-border)]'
const SHADOW = '[box-shadow:var(--pv-shadow)]'

// A mockup that assembles itself as the visitor picks parts and options: a browser for the website,
// phones for the bot and the app, a strip for automation, chips for extras. Purely decorative; the
// summary next to it carries the same information as text. The style step restyles it through CSS
// variables scoped to this box (colours, radii, type), so the rest of the page keeps the site look.
export function BuilderPreview({
  build,
  dict,
  locale = 'ru',
  className,
}: {
  build: Build
  dict: Dict
  locale?: string
  className?: string
}) {
  const p = dict.builder.preview
  const c = pick(previewCopy, locale)
  const site = build.parts.websites
  const bot = build.parts.bots
  const app = build.parts.apps
  const auto = build.parts.automation
  const products = build.products ?? []
  const mock: KindMock = build.kind ? kindCatalog[build.kind].mock : 'services'
  const brand = build.kind && build.kind !== 'other' ? kindName(build.kind, locale) : p.brand
  const hasPart = Boolean(site || bot || app || auto)
  const empty = !hasPart && build.extras.length === 0 && products.length === 0 && !build.kind
  // A kind or a product with no website part still gets a page to show: header, hero and the
  // block that suits the niche.
  const frame = Boolean(site) || (!bot && !app && !auto && !empty)
  const extraCards = products.filter((id) => id === 'content' || id === 'agent' || id === 'aiteam')

  return (
    <div
      aria-hidden="true"
      style={styleVars(build.style)}
      className={cn(
        'pv-root relative min-h-[420px] overflow-hidden rounded-card border border-line bg-surface-2 p-4 transition-[background-color,border-color] duration-500 md:p-5',
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {empty && (
          <Item key="empty" className="grid min-h-[380px] place-items-center">
            <p className="max-w-[26ch] text-center text-sm text-faint">{dict.builder.empty}</p>
          </Item>
        )}

        {frame && (
          <Item key="site">
            <div
              className={cn(
                'relative overflow-hidden rounded-xl bg-bg',
                BORDER,
                'border-line-strong',
                SHADOW,
              )}
            >
              <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="ml-2 truncate rounded-full bg-fg/5 px-2.5 py-0.5 font-mono text-[10px] text-faint">
                  {p.url}
                </span>
                <Flag show={Boolean(site?.addons.includes('language'))} className="ml-auto">
                  <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[9px] text-muted">
                    RU · EN
                  </span>
                </Flag>
              </div>
              <div className="grid gap-(--pv-gap) p-(--pv-pad)">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(HEAD, 'min-w-0 truncate text-[11px]')}>{brand}</span>
                  <span className="flex shrink-0 gap-1.5">
                    <Bar className="w-6" />
                    <Bar className="w-6" />
                    <Bar className="w-6" />
                  </span>
                </div>
                <div className="grid gap-1.5">
                  <span
                    className={cn(HEAD, 'max-w-[22ch] leading-[1.1] [font-size:calc(17px*var(--pv-hero))]')}
                  >
                    {c.headline}
                  </span>
                  <Bar className="w-1/2" />
                  <span className="mt-1.5 w-fit rounded-[var(--pv-button)] bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-ink">
                    {c.cta}
                  </span>
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {site?.variant === 'shop' ? (
                    <Item key="shop" className="grid grid-cols-3 gap-1.5">
                      {['$12', '$18', '$9'].map((price) => (
                        <span
                          key={price}
                          className={cn('grid gap-1 rounded-md p-1.5', BORDER, 'border-line')}
                        >
                          <span className="h-9 rounded-sm bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]" />
                          <span className="font-mono text-[9px] text-fg">{price}</span>
                          <span className="rounded-sm bg-fg/10 py-0.5 text-center text-[8px] text-muted">
                            {p.buy}
                          </span>
                        </span>
                      ))}
                    </Item>
                  ) : (
                    <Item key={`kind-${mock}`}>
                      <KindBlock mock={mock} c={c} />
                    </Item>
                  )}
                  {site?.variant === 'company' && (
                    <Item key="company" className="grid grid-cols-3 gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className={cn('grid gap-1 rounded-md p-2', BORDER, 'border-line')}
                        >
                          <span className="size-3 rounded-sm bg-accent/60" />
                          <Bar className="w-full" />
                          <Bar className="w-2/3" />
                        </span>
                      ))}
                    </Item>
                  )}
                </AnimatePresence>
                <Flag show={Boolean(site?.addons.includes('payments'))}>
                  <span className="block w-24">
                    <Pay label={p.pay} />
                  </span>
                </Flag>
              </div>
              <Flag show={Boolean(site?.addons.includes('cms'))} className="absolute top-10 right-2">
                <Badge>
                  <PencilSimple size={10} weight="bold" />
                  {p.edit}
                </Badge>
              </Flag>
              <Flag
                show={Boolean(site?.addons.includes('telegram'))}
                className="absolute right-2 bottom-2"
              >
                <span className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[10px] shadow-card">
                  <TelegramLogo size={12} weight="fill" className="text-tg" />
                  {p.toTelegram}
                </span>
              </Flag>
            </div>
          </Item>
        )}

        {(bot || app) && (
          <Item key="phones" className="mt-3 flex flex-wrap justify-center gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {bot && (
                <Item key="bot">
                  <Phone>
                    <div className="flex items-center gap-1.5 border-b border-line pb-2">
                      <span className="grid size-5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-ink">
                        F
                      </span>
                      <span className={cn(HEAD, 'text-[10px]')}>{p.bot}</span>
                      <Flag show={bot.addons.includes('ai')} className="ml-auto">
                        <Badge>
                          <Sparkle size={9} weight="fill" />
                          {p.ai}
                        </Badge>
                      </Flag>
                    </div>
                    <Flag show={bot.addons.includes('broadcasts')}>
                      <span className="mt-2 flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-1 text-[9px] text-accent-text">
                        <Bell size={9} weight="fill" />
                        {p.broadcast}
                      </span>
                    </Flag>
                    <div className="mt-2 grid gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {bot.variant === 'faq' && (
                          <Item key="faq" className="grid gap-1.5">
                            <Bubble mine>{products.includes('intake') ? c.chatQ : p.botFaq}</Bubble>
                            <Bubble>{products.includes('intake') ? c.chatA : p.botFaqAnswer}</Bubble>
                          </Item>
                        )}
                        {bot.variant === 'booking' && (
                          <Item key="booking" className="grid gap-1.5">
                            <Bubble mine>{c.chatQ}</Bubble>
                            <span className="flex gap-1">
                              {['11:00', '14:30', '17:00'].map((t, i) => (
                                <span
                                  key={t}
                                  className={cn(
                                    'rounded-md border px-1.5 py-1 font-mono text-[9px]',
                                    i === 1
                                      ? 'border-accent-text text-accent-text'
                                      : 'border-line text-muted',
                                  )}
                                >
                                  {t}
                                </span>
                              ))}
                            </span>
                          </Item>
                        )}
                        {bot.variant === 'miniapp' && (
                          <Item key="miniapp" className="grid gap-1.5">
                            <span className={cn(HEAD, 'text-[10px]')}>{p.botMenu}</span>
                            <span className="grid grid-cols-2 gap-1">
                              {[0, 1, 2, 3].map((i) => (
                                <span
                                  key={i}
                                  className="h-10 rounded-md bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]"
                                />
                              ))}
                            </span>
                          </Item>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="mt-auto grid gap-1.5 pt-2">
                      <Flag show={bot.addons.includes('payments')}>
                        <Pay label={p.pay} />
                      </Flag>
                      <Flag show={bot.addons.includes('admin')}>
                        <span className="block text-center font-mono text-[9px] text-faint">
                          {p.admin}
                        </span>
                      </Flag>
                    </div>
                  </Phone>
                </Item>
              )}
              {app && (
                <Item key="app">
                  <Phone>
                    <Flag show={app.addons.includes('push')}>
                      <span className="mb-2 flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-1.5 py-1.5 text-[9px]">
                        <Bell size={10} weight="fill" className="text-accent-text" />
                        {p.push}
                      </span>
                    </Flag>
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className={cn(HEAD, 'text-[10px]')}>{p.app}</span>
                      <Flag show={app.addons.includes('accounts')}>
                        <UserCircle size={14} className="text-accent-text" />
                      </Flag>
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {app.variant === 'internal' ? (
                          <Item key="internal" className="grid gap-1">
                            {[0, 1, 2, 3].map((i) => (
                              <span
                                key={i}
                                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-line px-1.5 py-1"
                              >
                                <Bar className="w-full" />
                                <span
                                  className={cn(
                                    'size-1.5 rounded-full',
                                    i % 2 ? 'bg-accent' : 'bg-fg/30',
                                  )}
                                />
                              </span>
                            ))}
                          </Item>
                        ) : (
                          <Item key="cards" className="grid gap-1.5">
                            <span className="h-14 rounded-lg bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]" />
                            <span className="grid grid-cols-2 gap-1">
                              <span className="h-8 rounded-md border border-line" />
                              <span className="h-8 rounded-md border border-line" />
                            </span>
                          </Item>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="mt-auto grid gap-1.5 pt-2">
                      <Flag show={app.addons.includes('payments')}>
                        <Pay label={p.pay} />
                      </Flag>
                      <span className="flex justify-around border-t border-line pt-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn('size-2 rounded-sm', i === 0 ? 'bg-accent' : 'bg-fg/20')}
                          />
                        ))}
                      </span>
                      <Flag show={app.addons.includes('admin')}>
                        <span className="block text-center font-mono text-[9px] text-faint">
                          {p.admin}
                        </span>
                      </Flag>
                    </div>
                  </Phone>
                </Item>
              )}
            </AnimatePresence>
          </Item>
        )}

        {auto && (
          <Item key="auto" className="mt-3">
            <div className="rounded-xl border border-line-strong bg-bg p-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {auto.variant === 'crm' ? (
                  <Item key="crm" className="grid grid-cols-3 gap-1.5">
                    {p.crm.map((col, i) => (
                      <span
                        key={col}
                        className="grid content-start gap-1 rounded-md bg-fg/[0.04] p-1.5"
                      >
                        <span className="text-[9px] text-muted">{col}</span>
                        {Array.from({ length: 3 - i }, (_, k) => (
                          <span
                            key={k}
                            className={cn(
                              'h-3.5 rounded-sm border border-line',
                              i === 1 && k === 0 && 'border-accent-text/60 bg-accent/10',
                            )}
                          />
                        ))}
                      </span>
                    ))}
                  </Item>
                ) : auto.variant === 'assistant' ? (
                  <Item key="assistant" className="flex items-center gap-2 text-[11px]">
                    <Sparkle size={14} weight="fill" className="text-accent-text" />
                    {p.assistant}
                  </Item>
                ) : (
                  <Item key="integration" className="flex items-center gap-1.5 text-[10px]">
                    <Chip>{dict.hero.demo.site}</Chip>
                    <Flow />
                    <Chip>
                      <TelegramLogo size={10} weight="fill" className="text-tg" />
                      Telegram
                    </Chip>
                    <Flow />
                    <Chip>{dict.hero.demo.crm}</Chip>
                  </Item>
                )}
              </AnimatePresence>
              <Chips
                items={[
                  auto.addons.includes('sheets') && p.sheets,
                  auto.addons.includes('alerts') && p.alerts,
                  auto.addons.includes('training') && p.training,
                  auto.addons.includes('support') &&
                    dict.estimator.catalog.automation.addons.support,
                ]}
              />
            </div>
          </Item>
        )}

        {extraCards.length > 0 && (
          <Item key="cards" className="mt-3 grid gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {extraCards.map((id) => (
                <Item key={id}>
                  <ProductCard id={id} c={c} />
                </Item>
              ))}
            </AnimatePresence>
          </Item>
        )}

        {products.length > 0 && (
          <Item key="chips" className="mt-3 flex flex-wrap gap-1.5">
            {products.map((id) => (
              <Chip key={id}>
                <CheckCircle size={11} weight="fill" className="text-accent-text" />
                {pick(productCatalog[id].name, locale)}
                {!productCatalog[id].priced && (
                  <span className="text-faint">· {pick(builderUi.onRequestShort, locale)}</span>
                )}
              </Chip>
            ))}
          </Item>
        )}

        {build.extras.length > 0 && (
          <Item key="extras" className="mt-3 flex flex-wrap gap-1.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {build.extras.includes('seo') && (
                <Item key="seo">
                  <Chip>
                    <MapPin size={11} weight="fill" className="text-accent-text" />
                    {p.seo}
                  </Chip>
                </Item>
              )}
              {build.extras.includes('design') && (
                <Item key="design">
                  <Chip>
                    <span className="flex -space-x-1">
                      <span className="size-2.5 rounded-full bg-accent ring-1 ring-bg" />
                      <span className="size-2.5 rounded-full bg-[var(--color-pine)] ring-1 ring-bg" />
                      <span className="size-2.5 rounded-full bg-fg ring-1 ring-bg" />
                    </span>
                    {p.design}
                  </Chip>
                </Item>
              )}
              {build.extras.includes('support') && (
                <Item key="support">
                  <Chip>
                    <Lifebuoy size={11} className="text-accent-text" />
                    {p.support}
                  </Chip>
                </Item>
              )}
            </AnimatePresence>
          </Item>
        )}
      </AnimatePresence>
    </div>
  )
}

function Item({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      layout={!reduce}
      className={className}
      initial={reduce ? false : { opacity: 0, scale: 0.92, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.45, ease }}
    >
      {children}
    </motion.div>
  )
}

// An option that pops in and out of the mockup.
function Flag({
  show,
  children,
  className,
}: {
  show: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <Item key="on" className={className}>
          {children}
        </Item>
      )}
    </AnimatePresence>
  )
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex h-[250px] w-[148px] flex-col rounded-[var(--pv-phone)] border-line-strong bg-bg p-2.5 pt-3',
        BORDER,
        SHADOW,
      )}
    >
      <span className="mx-auto mb-2 h-1 w-8 rounded-full bg-fg/15" />
      {children}
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return <span className={cn('block h-1.5 rounded-full bg-fg/15', className)} />
}

function Bubble({ children, mine }: { children: ReactNode; mine?: boolean }) {
  return (
    <span
      className={cn(
        'max-w-[90%] rounded-lg px-2 py-1 text-[9px] leading-snug',
        mine ? 'justify-self-end bg-accent text-accent-ink' : 'bg-fg/10 text-fg',
      )}
    >
      {children}
    </span>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--pv-button)] border border-accent-text/40 bg-accent/10 px-1.5 py-0.5 text-[9px] whitespace-nowrap text-accent-text">
      {children}
    </span>
  )
}

function Pay({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-1 rounded-md bg-fg py-1 text-[9px] font-medium text-bg">
      <CreditCard size={10} weight="bold" />
      {label}
    </span>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--pv-button)] border border-line-strong bg-bg px-2 py-1 text-[10px] whitespace-nowrap">
      {children}
    </span>
  )
}

function Chips({ items }: { items: (string | false)[] }) {
  const list = items.filter((item): item is string => Boolean(item))
  return (
    <AnimatePresence initial={false}>
      {list.length > 0 && (
        <Item key="chips" className="mt-2.5 flex flex-wrap gap-1">
          {list.map((item) => (
            <Chip key={item}>{item}</Chip>
          ))}
        </Item>
      )}
    </AnimatePresence>
  )
}

// A dot travelling along the link between two services.
function Flow() {
  const reduce = useReducedMotion()
  return (
    <span className="relative h-px w-5 shrink-0 bg-line-strong">
      {!reduce && (
        <motion.span
          className="absolute -top-[2px] size-[5px] rounded-full bg-accent"
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <ArrowRight size={8} className="absolute -top-1 -right-1 text-faint" />
    </span>
  )
}

// A small page in one style, for the gallery cards and the axis pickers: the same variables and
// the same hooks as the mockup, so a card is the mockup in miniature.
export function StyleSample({
  style,
  title,
  cta,
  className,
}: {
  style: BuildStyle
  title: string
  cta: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={styleVars(style)}
      className={cn(
        'pv-root block overflow-hidden rounded-xl border border-line bg-surface-2 p-2 transition-colors duration-300',
        className,
      )}
    >
      <span
        className={cn(
          'block overflow-hidden rounded-lg bg-bg p-(--pv-pad)',
          BORDER,
          'border-line-strong',
          SHADOW,
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span className={cn(HEAD, 'min-w-0 truncate text-[8px]')}>{title}</span>
          <span className="flex shrink-0 gap-1">
            <Bar className="w-2.5" />
            <Bar className="w-2.5" />
          </span>
        </span>
        <span
          className={cn(
            HEAD,
            'mt-2 block max-w-[10ch] leading-[1.05] [font-size:calc(15px*var(--pv-hero))]',
          )}
        >
          {title}
        </span>
        <span className="mt-2 flex items-center gap-1.5">
          <span className="rounded-[var(--pv-button)] bg-accent px-2 py-0.5 text-[7px] font-medium text-accent-ink">
            {cta}
          </span>
          <Bar className="w-6" />
        </span>
        <span className="mt-2 grid grid-cols-3 gap-(--pv-gap)">
          <span className="h-5 rounded-md bg-pine" />
          <span className={cn('h-5 rounded-md', BORDER, 'border-line-strong')} />
          <span className={cn('h-5 rounded-md', BORDER, 'border-line-strong')} />
        </span>
      </span>
    </span>
  )
}

type Copy = PreviewCopy

// The niche's own block on the page: a menu, a booking widget, a catalogue, a lesson, listings,
// trips, a service list, a price quote or a chat. Generic copy, so every kind has something to show.
function KindBlock({ mock, c }: { mock: KindMock; c: Copy }) {
  const tile =
    'h-9 rounded-sm bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]'
  const card = cn('rounded-md p-1.5', BORDER, 'border-line')
  switch (mock) {
    case 'menu':
      return (
        <div className={cn('grid gap-1', card)}>
          <span className={cn(HEAD, 'text-[10px]')}>{c.menu[0]}</span>
          {[c.menu[1], c.menu[2], c.menu[3]].map(([name, price]) => (
            <span key={name} className="flex items-baseline gap-1 text-[9px]">
              <span className="truncate">{name}</span>
              <span className="min-w-2 flex-1 border-b border-dotted border-line-strong" />
              <span className="font-mono text-accent-text">{price}</span>
            </span>
          ))}
        </div>
      )
    case 'booking':
      return (
        <div className={cn('grid gap-1.5', card)}>
          <span className="flex items-center gap-1 text-[10px]">
            <CalendarCheck size={11} weight="fill" className="text-accent-text" />
            <span className={HEAD}>{c.book}</span>
          </span>
          <span className="grid grid-cols-5 gap-1">
            {[12, 13, 14, 15, 16].map((d, i) => (
              <span
                key={d}
                className={cn(
                  'rounded-sm py-0.5 text-center font-mono text-[9px]',
                  i === 2 ? 'bg-accent text-accent-ink' : 'bg-fg/10 text-muted',
                )}
              >
                {d}
              </span>
            ))}
          </span>
          <span className="flex gap-1">
            {['11:00', '14:30', '17:00'].map((t, i) => (
              <span
                key={t}
                className={cn(
                  'rounded-md border px-1.5 py-1 font-mono text-[9px]',
                  i === 1 ? 'border-accent-text text-accent-text' : 'border-line text-muted',
                )}
              >
                {t}
              </span>
            ))}
          </span>
        </div>
      )
    case 'catalog':
      return (
        <div className="grid grid-cols-3 gap-1.5">
          {['$24', '$38', '$15'].map((price) => (
            <span key={price} className={cn('grid gap-1', card)}>
              <span className={tile} />
              <span className="font-mono text-[9px]">{price}</span>
              <span className="rounded-sm bg-fg/10 py-0.5 text-center text-[8px] text-muted">
                {c.cart}
              </span>
            </span>
          ))}
        </div>
      )
    case 'lesson':
      return (
        <div className={cn('grid gap-1.5', card)}>
          <span className="flex items-center gap-1 text-[10px]">
            <BookOpen size={11} weight="fill" className="text-accent-text" />
            <span className={HEAD}>{c.lesson[0]}</span>
          </span>
          <span className="text-[9px] text-muted">{c.lesson[1]}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-fg/10">
            <span className="block h-full w-1/4 rounded-full bg-accent" />
          </span>
        </div>
      )
    case 'listing':
      return (
        <div className="grid gap-1.5">
          {c.listing.map((name, i) => (
            <span key={name} className={cn('grid grid-cols-[2.5rem_1fr] items-center gap-2', card)}>
              <span className={cn(tile, 'h-8')} />
              <span className="grid gap-1">
                <span className="truncate text-[9px]">{name}</span>
                <span className="font-mono text-[9px] text-accent-text">{i ? '$78k' : '$52k'}</span>
              </span>
            </span>
          ))}
        </div>
      )
    case 'trip':
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {c.trip.map((name, i) => (
            <span key={name} className={cn('grid gap-1', card)}>
              <span className={tile} />
              <span className="truncate text-[9px]">{name}</span>
              <span className="font-mono text-[9px] text-accent-text">{i ? '$540' : '$820'}</span>
            </span>
          ))}
        </div>
      )
    case 'quote':
      return (
        <div className={cn('grid gap-1.5', card)}>
          <span className={cn(HEAD, 'text-[10px]')}>{c.quote[0]}</span>
          <span className="grid grid-cols-2 gap-1">
            <span className="h-4 rounded-sm border border-line" />
            <span className="h-4 rounded-sm border border-line" />
          </span>
          <span className="flex items-center justify-between text-[9px]">
            <span className="text-muted">{c.quote[1]}</span>
            <span className="font-mono text-accent-text">$120</span>
          </span>
        </div>
      )
    case 'chat':
      return (
        <div className={cn('grid gap-1', card)}>
          <Bubble mine>{c.chatQ}</Bubble>
          <Bubble>{c.chatA}</Bubble>
        </div>
      )
    default:
      return (
        <div className={cn('grid gap-1', card)}>
          {c.services.map((name, i) => (
            <span key={name} className="flex items-center gap-1.5 text-[9px]">
              <span className="size-1.5 rounded-full bg-accent" />
              <span className="flex-1 truncate">{name}</span>
              <span className="font-mono text-muted">${(i + 1) * 20}</span>
            </span>
          ))}
        </div>
      )
  }
}

// Mini screens for the products that have no part of their own: a content plan, a personal agent
// and a company knowledge base.
function ProductCard({ id, c }: { id: 'content' | 'agent' | 'aiteam'; c: Copy }) {
  const wrap = cn('grid gap-1.5 rounded-xl bg-bg p-(--pv-pad)', BORDER, 'border-line-strong')
  if (id === 'content')
    return (
      <div className={wrap}>
        <span className="flex items-center gap-1 text-[10px]">
          <Sparkle size={11} weight="fill" className="text-accent-text" />
          <span className={HEAD}>{c.contentTitle}</span>
        </span>
        <span className="grid grid-cols-4 gap-1.5">
          {c.content.map((day, i) => (
            <span key={day} className="grid gap-1">
              <span className="font-mono text-[8px] text-faint">{day}</span>
              <span
                className={cn(
                  'h-9 rounded-md',
                  i % 2
                    ? 'bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]'
                    : 'bg-accent/80',
                )}
              />
              <Bar className="w-full" />
            </span>
          ))}
        </span>
      </div>
    )
  if (id === 'agent')
    return (
      <div className={wrap}>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
            <Robot size={11} weight="fill" />
          </span>
          <span className={HEAD}>{c.agentTitle}</span>
        </span>
        {c.agentTasks.map((task, i) => (
          <span key={task} className="flex items-center gap-1.5 text-[9px]">
            <span
              className={cn(
                'size-2.5 rounded-sm border',
                i === 0 ? 'border-accent-text bg-accent' : 'border-line-strong',
              )}
            />
            {task}
          </span>
        ))}
      </div>
    )
  return (
    <div className={wrap}>
      <span className="flex items-center gap-1.5 text-[10px]">
        <Brain size={12} weight="fill" className="text-accent-text" />
        <span className={HEAD}>{c.teamTitle}</span>
      </span>
      <Bubble mine>{c.teamQ}</Bubble>
      <Bubble>{c.teamA}</Bubble>
      <span className="w-fit rounded-full border border-accent-text/40 px-1.5 py-0.5 font-mono text-[8px] text-accent-text">
        doc.pdf
      </span>
    </div>
  )
}
