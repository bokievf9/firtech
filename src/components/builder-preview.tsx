'use client'

import {
  ArrowRight,
  Bell,
  CreditCard,
  Lifebuoy,
  MapPin,
  PencilSimple,
  Sparkle,
  TelegramLogo,
  UserCircle,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import type { Build } from '@/lib/builder'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// A mockup that assembles itself as the visitor picks parts and options: a browser for the website,
// phones for the bot and the app, a strip for automation, chips for extras. Purely decorative; the
// summary next to it carries the same information as text.
export function BuilderPreview({ build, dict }: { build: Build; dict: Dict }) {
  const p = dict.builder.preview
  const site = build.parts.websites
  const bot = build.parts.bots
  const app = build.parts.apps
  const auto = build.parts.automation
  const empty = !site && !bot && !app && !auto && build.extras.length === 0

  return (
    <div
      aria-hidden="true"
      className="dot-grid relative min-h-[420px] overflow-hidden rounded-card border border-line bg-surface-2 p-4 md:p-5"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {empty && (
          <Item key="empty" className="grid min-h-[380px] place-items-center">
            <p className="max-w-[26ch] text-center text-sm text-faint">{dict.builder.empty}</p>
          </Item>
        )}

        {site && (
          <Item key="site">
            <div className="relative overflow-hidden rounded-xl border border-line-strong bg-bg">
              <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="ml-2 truncate rounded-full bg-fg/5 px-2.5 py-0.5 font-mono text-[10px] text-faint">
                  {p.url}
                </span>
                <Flag show={site.addons.includes('language')} className="ml-auto">
                  <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[9px] text-muted">
                    RU · EN
                  </span>
                </Flag>
              </div>
              <div className="grid gap-3 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold">{p.brand}</span>
                  <span className="flex gap-1.5">
                    <Bar className="w-6" />
                    <Bar className="w-6" />
                    <Bar className="w-6" />
                  </span>
                </div>
                <div className="grid gap-1.5">
                  <Bar className="h-2.5 w-3/4 bg-fg/70" />
                  <Bar className="w-1/2" />
                  <span className="mt-1.5 w-fit rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-ink">
                    {p.cta}
                  </span>
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {site.variant === 'landing' && (
                    <Item key="landing" className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                      <span className="h-6 rounded-md border border-line" />
                      <span className="h-6 rounded-md border border-line" />
                      <span className="h-6 w-10 rounded-md bg-fg/80" />
                    </Item>
                  )}
                  {site.variant === 'company' && (
                    <Item key="company" className="grid grid-cols-3 gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="grid gap-1 rounded-md border border-line p-2">
                          <span className="size-3 rounded-sm bg-accent/60" />
                          <Bar className="w-full" />
                          <Bar className="w-2/3" />
                        </span>
                      ))}
                    </Item>
                  )}
                  {site.variant === 'shop' && (
                    <Item key="shop" className="grid grid-cols-3 gap-1.5">
                      {['$12', '$18', '$9'].map((price) => (
                        <span
                          key={price}
                          className="grid gap-1 rounded-md border border-line p-1.5"
                        >
                          <span className="h-9 rounded-sm bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]" />
                          <span className="font-mono text-[9px] text-fg">{price}</span>
                          <span className="rounded-sm bg-fg/10 py-0.5 text-center text-[8px] text-muted">
                            {p.buy}
                          </span>
                        </span>
                      ))}
                    </Item>
                  )}
                </AnimatePresence>
                <Flag show={site.addons.includes('payments')}>
                  <span className="block w-24">
                    <Pay label={p.pay} />
                  </span>
                </Flag>
              </div>
              <Flag show={site.addons.includes('cms')} className="absolute top-10 right-2">
                <Badge>
                  <PencilSimple size={10} weight="bold" />
                  {p.edit}
                </Badge>
              </Flag>
              <Flag show={site.addons.includes('telegram')} className="absolute right-2 bottom-2">
                <span className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[10px] shadow-lg shadow-black/30">
                  <TelegramLogo size={12} weight="fill" className="text-[#5cc4f5]" />
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
                      <span className="text-[10px] font-medium">{p.bot}</span>
                      <Flag show={bot.addons.includes('ai')} className="ml-auto">
                        <Badge>
                          <Sparkle size={9} weight="fill" />
                          {p.ai}
                        </Badge>
                      </Flag>
                    </div>
                    <Flag show={bot.addons.includes('broadcasts')}>
                      <span className="mt-2 flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-1 text-[9px] text-accent">
                        <Bell size={9} weight="fill" />
                        {p.broadcast}
                      </span>
                    </Flag>
                    <div className="mt-2 grid gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {bot.variant === 'faq' && (
                          <Item key="faq" className="grid gap-1.5">
                            <Bubble mine>{p.botFaq}</Bubble>
                            <Bubble>{p.botFaqAnswer}</Bubble>
                          </Item>
                        )}
                        {bot.variant === 'booking' && (
                          <Item key="booking" className="grid gap-1.5">
                            <Bubble mine>{p.botBook}</Bubble>
                            <span className="flex gap-1">
                              {['11:00', '14:30', '17:00'].map((t, i) => (
                                <span
                                  key={t}
                                  className={cn(
                                    'rounded-md border px-1.5 py-1 font-mono text-[9px]',
                                    i === 1
                                      ? 'border-accent text-accent'
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
                            <span className="text-[10px] font-medium">{p.botMenu}</span>
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
                        <Bell size={10} weight="fill" className="text-accent" />
                        {p.push}
                      </span>
                    </Flag>
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className="text-[10px] font-medium">{p.app}</span>
                      <Flag show={app.addons.includes('accounts')}>
                        <UserCircle size={14} className="text-accent" />
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
                              i === 1 && k === 0 && 'border-accent/60 bg-accent/10',
                            )}
                          />
                        ))}
                      </span>
                    ))}
                  </Item>
                ) : auto.variant === 'assistant' ? (
                  <Item key="assistant" className="flex items-center gap-2 text-[11px]">
                    <Sparkle size={14} weight="fill" className="text-accent" />
                    {p.assistant}
                  </Item>
                ) : (
                  <Item key="integration" className="flex items-center gap-1.5 text-[10px]">
                    <Chip>{dict.hero.demo.site}</Chip>
                    <Flow />
                    <Chip>
                      <TelegramLogo size={10} weight="fill" className="text-[#5cc4f5]" />
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

        {build.extras.length > 0 && (
          <Item key="extras" className="mt-3 flex flex-wrap gap-1.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {build.extras.includes('seo') && (
                <Item key="seo">
                  <Chip>
                    <MapPin size={11} weight="fill" className="text-accent" />
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
                    <Lifebuoy size={11} className="text-accent" />
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
    <div className="flex h-[250px] w-[148px] flex-col rounded-[22px] border border-line-strong bg-bg p-2.5 pt-3">
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
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] whitespace-nowrap text-accent">
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
    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-bg px-2 py-1 text-[10px] whitespace-nowrap">
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
