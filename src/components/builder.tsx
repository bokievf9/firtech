'use client'

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ChatCircleDots,
  Check,
  Coffee,
  DeviceMobile,
  DotsThreeOutline,
  FlowArrow,
  Globe,
  Link as LinkIcon,
  Moped,
  Plus,
  Scissors,
  Storefront,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import {
  buildExtras,
  businessKinds,
  decodeBuild,
  emptyBuild,
  encodeBuild,
  presets,
  quote,
  type Build,
  type BusinessKind,
  type BuildExtra,
} from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { track } from '@/lib/analytics'
import { sendEstimate } from '@/lib/estimate-event'
import { bundleDiscount, catalog, extraPrice, formatUsd, startingPrice } from '@/lib/pricing'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { BuilderPreview } from './builder-preview'

const ease = [0.16, 1, 0.3, 1] as const

const kindIcons: Record<BusinessKind, Icon> = {
  cafe: Coffee,
  salon: Scissors,
  shop: Storefront,
  delivery: Moped,
  services: Briefcase,
  other: DotsThreeOutline,
}

const serviceIcons: Record<ServiceSlug, Icon> = {
  websites: Globe,
  bots: ChatCircleDots,
  apps: DeviceMobile,
  automation: FlowArrow,
}

type Variants = Record<string, { name: string; term: string }>

const range = (r: { min: number; max: number }) => `${formatUsd(r.min)} - ${formatUsd(r.max)}`

export function Builder({ dict }: { dict: Dict }) {
  const t = dict.builder
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<BusinessKind | null>(null)
  const [build, setBuild] = useState<Build>(emptyBuild)
  const [copied, setCopied] = useState(false)
  const [atForm, setAtForm] = useState(false)
  const loaded = useRef(false)
  const top = useRef<HTMLDivElement>(null)

  // A shared link (?b=...) opens straight on the summary. Read after mount: the page is static, so
  // the server never sees the query string.
  useEffect(() => {
    const shared = decodeBuild(new URLSearchParams(window.location.search).get('b'))
    loaded.current = true
    if (!shared) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    setBuild(shared)
    setStep(3)
  }, [])

  // Keep the link in sync with the build, without a navigation.
  useEffect(() => {
    if (!loaded.current) return
    const code = encodeBuild(build)
    const url = code ? `${window.location.pathname}?b=${code}` : window.location.pathname
    window.history.replaceState(window.history.state, '', url)
  }, [build])

  useEffect(() => {
    const target = document.getElementById('contact')
    if (!target) return
    const io = new IntersectionObserver(([entry]) => setAtForm(entry?.isIntersecting ?? false), {
      rootMargin: '0px 0px -30% 0px',
    })
    io.observe(target)
    return () => io.disconnect()
  }, [])

  const q = quote(build)
  const hasParts = Object.keys(build.parts).length > 0
  const canGo = step === 0 ? kind !== null || hasParts : hasParts

  function go(next: number) {
    setStep(next)
    track('builder_step', { step: next + 1 })
    const el = top.current
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
  }

  function pickKind(next: BusinessKind) {
    setKind(next)
    setBuild(structuredClone(presets[next]))
    go(1)
  }

  function toggleService(slug: ServiceSlug) {
    setBuild((b) => {
      const parts = { ...b.parts }
      if (parts[slug]) delete parts[slug]
      else parts[slug] = { variant: Object.keys(catalog[slug].variants)[0] ?? '', addons: [] }
      return { ...b, parts }
    })
  }

  function setVariant(slug: ServiceSlug, variant: string) {
    setBuild((b) => {
      const part = b.parts[slug]
      return part ? { ...b, parts: { ...b.parts, [slug]: { ...part, variant } } } : b
    })
  }

  function toggleAddon(slug: ServiceSlug, id: string) {
    setBuild((b) => {
      const part = b.parts[slug]
      if (!part) return b
      const addons = part.addons.includes(id)
        ? part.addons.filter((a) => a !== id)
        : [...part.addons, id]
      return { ...b, parts: { ...b.parts, [slug]: { ...part, addons } } }
    })
  }

  function toggleExtra(id: BuildExtra) {
    setBuild((b) => ({
      ...b,
      extras: b.extras.includes(id) ? b.extras.filter((e) => e !== id) : [...b.extras, id],
    }))
  }

  function partLabel(slug: ServiceSlug) {
    const part = build.parts[slug]
    if (!part) return ''
    const c = dict.estimator.catalog[slug]
    const variant = (c.variants as Variants)[part.variant]
    const addons = part.addons.map((id) => (c.addons as Record<string, string>)[id])
    return [variant?.name, ...addons].filter(Boolean).join(' + ')
  }

  function partTerm(slug: ServiceSlug) {
    const part = build.parts[slug]
    if (!part) return ''
    return (dict.estimator.catalog[slug].variants as Variants)[part.variant]?.term ?? ''
  }

  function handOff() {
    const lines = q.lines.map((line) => {
      if (isService(line.id)) {
        const name = dict.services.items[line.id].name
        return `${name}: ${partLabel(line.id)} (${range(line)}, ${partTerm(line.id)})`
      }
      return `${dict.extras.items[line.id].name} (${range(line)})`
    })
    if (q.discount) lines.push(`${t.discount}: ${range(q.subtotal)} -> ${range(q.total)}`)
    lines.push(`${t.total}: ${range(q.total)}`)
    if (q.monthly)
      lines.push(`${dict.extras.items.support.name}: ${formatUsd(q.monthly)}${t.perMonth}`)
    const single = q.lines.length === 1 && !q.monthly ? q.lines[0]?.id : undefined
    const service = single && isService(single) ? single : 'bundle'
    sendEstimate({ service, summary: lines.join('\n') })
    track('builder_sent', { service })
    document.getElementById('contact')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      track('builder_link_copied')
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard can be blocked (http, permissions); the link is still in the address bar.
    }
  }

  const last = step === t.steps.length - 1

  return (
    <div ref={top} className="scroll-mt-24 grid gap-6 pb-24 lg:grid-cols-12 lg:pb-0">
      <div className="min-w-0 rounded-card border border-line bg-surface lg:col-span-7">
        <ol className="flex border-b border-line">
          {t.steps.map((label, i) => {
            const reachable = i === 0 || hasParts
            return (
              <li key={label} className="flex-1">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => go(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={cn(
                    'relative flex w-full flex-col items-start gap-1 px-3 py-4 text-left transition-colors md:px-6',
                    i === step ? 'text-fg' : 'text-faint hover:text-muted',
                    !reachable && 'cursor-not-allowed hover:text-faint',
                  )}
                >
                  <span className="font-mono text-[11px]">0{i + 1}</span>
                  <span className="hidden text-sm font-medium sm:block">{label}</span>
                  {i === step && (
                    <motion.span
                      layoutId="builder-step"
                      className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                      transition={{ duration: 0.4, ease }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="p-5 md:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -16 }}
              transition={{ duration: 0.3, ease }}
            >
              {step === 0 && (
                <Step title={t.kindTitle} sub={t.kindSub}>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {businessKinds.map((id) => {
                      const Glyph = kindIcons[id]
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={kind === id}
                          onClick={() => pickKind(id)}
                          className={cn(
                            'flex flex-col items-start gap-4 rounded-xl border p-4 text-left transition-colors duration-200 active:scale-[0.98]',
                            kind === id
                              ? 'border-accent bg-accent/[0.07]'
                              : 'border-line hover:border-line-strong',
                          )}
                        >
                          <Glyph size={24} className="text-accent" />
                          <span className="text-[15px] font-medium leading-tight">
                            {t.kinds[id]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Step>
              )}

              {step === 1 && (
                <Step title={t.partsTitle} sub={t.partsSub}>
                  <div className="grid gap-2">
                    {serviceSlugs.map((slug) => {
                      const part = build.parts[slug]
                      const Glyph = serviceIcons[slug]
                      const variants = dict.estimator.catalog[slug].variants as Variants
                      return (
                        <div
                          key={slug}
                          className={cn(
                            'rounded-xl border transition-colors duration-200',
                            part ? 'border-accent/60 bg-accent/[0.04]' : 'border-line',
                          )}
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={Boolean(part)}
                            onClick={() => toggleService(slug)}
                            className="flex w-full items-center gap-4 p-4 text-left"
                          >
                            <Glyph size={22} className={part ? 'text-accent' : 'text-muted'} />
                            <span className="flex-1 font-medium">
                              {dict.services.items[slug].name}
                            </span>
                            <span className="font-mono text-sm text-muted">
                              {dict.services.from} {formatUsd(startingPrice[slug])}
                            </span>
                            <Tick on={Boolean(part)} />
                          </button>
                          <AnimatePresence initial={false}>
                            {part && (
                              <motion.div
                                initial={reduce ? false : { height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={reduce ? undefined : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="grid gap-2 px-4 pb-4 sm:grid-cols-3"
                                  role="radiogroup"
                                  aria-label={dict.estimator.variant}
                                >
                                  {Object.entries(variants).map(([id, v]) => (
                                    <button
                                      key={id}
                                      type="button"
                                      role="radio"
                                      aria-checked={part.variant === id}
                                      onClick={() => setVariant(slug, id)}
                                      className={cn(
                                        'rounded-lg border px-3 py-2.5 text-left transition-colors duration-200',
                                        part.variant === id
                                          ? 'border-accent bg-accent/[0.08]'
                                          : 'border-line hover:border-line-strong',
                                      )}
                                    >
                                      <span className="block text-sm font-medium">{v.name}</span>
                                      <span className="mt-0.5 flex justify-between gap-2 text-xs text-faint">
                                        {v.term}
                                        <span className="font-mono">
                                          {formatUsd(catalog[slug].variants[id] ?? 0)}
                                        </span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                  {!hasParts && <p className="mt-4 text-sm text-danger">{t.pickOne}</p>}
                </Step>
              )}

              {step === 2 && (
                <Step title={t.featuresTitle} sub={t.featuresSub}>
                  <div className="grid gap-7">
                    {serviceSlugs.map((slug) => {
                      const part = build.parts[slug]
                      if (!part) return null
                      const names = dict.estimator.catalog[slug].addons as Record<string, string>
                      return (
                        <fieldset key={slug}>
                          <legend className="mb-3 text-sm text-muted">
                            {dict.services.items[slug].name}
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(names).map(([id, name]) => (
                              <Pill
                                key={id}
                                on={part.addons.includes(id)}
                                onClick={() => toggleAddon(slug, id)}
                                price={`+${formatUsd(catalog[slug].addons[id] ?? 0)}`}
                              >
                                {name}
                              </Pill>
                            ))}
                          </div>
                        </fieldset>
                      )
                    })}
                    <fieldset>
                      <legend className="mb-3 text-sm text-muted">{t.extrasTitle}</legend>
                      <div className="flex flex-wrap gap-2">
                        {buildExtras.map((id) => {
                          const price = extraPrice[id]
                          return (
                            <Pill
                              key={id}
                              on={build.extras.includes(id)}
                              onClick={() => toggleExtra(id)}
                              price={
                                price.from === null
                                  ? undefined
                                  : `+${formatUsd(price.from)}${price.monthly ? t.perMonth : ''}`
                              }
                            >
                              {dict.extras.items[id].name}
                            </Pill>
                          )
                        })}
                      </div>
                    </fieldset>
                  </div>
                </Step>
              )}

              {step === 3 && (
                <Step title={t.summaryTitle}>
                  {hasParts ? (
                    <>
                      <ul className="divide-y divide-line border-y border-line">
                        {q.lines.map((line) => (
                          <li key={line.id} className="flex items-start justify-between gap-4 py-4">
                            <span>
                              <span className="block font-medium">
                                {isService(line.id)
                                  ? dict.services.items[line.id].name
                                  : dict.extras.items[line.id].name}
                              </span>
                              {isService(line.id) && (
                                <span className="mt-1 block text-sm text-muted">
                                  {partLabel(line.id)}
                                  <span className="text-faint"> · {partTerm(line.id)}</span>
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-mono text-sm">{range(line)}</span>
                          </li>
                        ))}
                        {q.monthly !== null && (
                          <li className="flex items-start justify-between gap-4 py-4">
                            <span className="font-medium">{dict.extras.items.support.name}</span>
                            <span className="shrink-0 font-mono text-sm">
                              {formatUsd(q.monthly)}
                              {t.perMonth}
                            </span>
                          </li>
                        )}
                      </ul>
                      <dl className="mt-5 grid gap-2 text-sm">
                        {q.discount && (
                          <>
                            <Row label={t.subtotal} value={range(q.subtotal)} muted />
                            <Row
                              label={t.discount}
                              value={`-${Math.round(bundleDiscount * 100)}%`}
                              className="text-accent"
                            />
                          </>
                        )}
                        <Row label={t.total} value={range(q.total)} strong />
                      </dl>
                      <ul className="mt-6 grid gap-2 text-[13px] leading-relaxed text-faint">
                        <li>{t.termsNote}</li>
                        <li>{t.payNote}</li>
                        {q.monthly !== null && <li>{t.monthlyNote}</li>}
                        <li>{t.note}</li>
                      </ul>
                      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handOff}
                          className={cn(buttonStyles.primary, 'sm:flex-1')}
                        >
                          {t.send}
                          <ArrowRight size={16} />
                        </button>
                        <button type="button" onClick={copyLink} className={buttonStyles.secondary}>
                          {copied ? <Check size={16} /> : <LinkIcon size={16} />}
                          <span aria-live="polite">{copied ? t.copied : t.copy}</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted">{t.pickOne}</p>
                  )}
                </Step>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 hidden items-center justify-between lg:flex">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
              >
                <ArrowLeft size={14} />
                {t.back}
              </button>
            ) : (
              <span />
            )}
            {!last && (
              <button
                type="button"
                disabled={!canGo}
                onClick={() => go(step + 1)}
                className={cn(
                  buttonStyles.primary,
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                {t.next}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5">
        <div className="grid gap-4 lg:sticky lg:top-24">
          <p className="text-sm text-muted">{t.previewLabel}</p>
          <BuilderPreview build={build} dict={dict} />
          <div className="hidden flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-card border border-line bg-surface px-6 py-5 lg:flex">
            <div>
              <p className="text-sm text-muted">{t.total}</p>
              <Total value={hasParts ? range(q.total) : '-'} />
            </div>
            <div className="text-right text-sm">
              {q.discount && <p className="whitespace-nowrap text-accent">{t.discount}</p>}
              {q.monthly !== null && (
                <p className="font-mono text-muted">
                  + {formatUsd(q.monthly)}
                  {t.perMonth}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phones: running total and the next step, always at hand. */}
      <AnimatePresence>
        {!atForm && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-2 rounded-full border border-line-strong bg-bg/85 p-1.5 pl-3 backdrop-blur-xl lg:hidden"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(step - 1)}
                aria-label={t.back}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="min-w-0 flex-1 truncate px-1 font-mono text-sm text-accent">
              {hasParts ? range(q.total) : ''}
            </span>
            {last ? (
              hasParts && (
                <button
                  type="button"
                  onClick={handOff}
                  className={cn(buttonStyles.primary, 'py-3')}
                >
                  {t.send}
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={!canGo}
                onClick={() => go(step + 1)}
                className={cn(buttonStyles.primary, 'py-3 disabled:opacity-40')}
              >
                {t.next}
                <ArrowRight size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function isService(id: string): id is ServiceSlug {
  return (serviceSlugs as readonly string[]).includes(id)
}

function Step({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      {sub && <p className="mt-2 max-w-[52ch] text-muted">{sub}</p>}
      <div className="mt-7">{children}</div>
    </div>
  )
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-200',
        on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-transparent',
      )}
    >
      <Check size={12} weight="bold" />
    </span>
  )
}

function Pill({
  on,
  onClick,
  price,
  children,
}: {
  on: boolean
  onClick: () => void
  price?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors duration-200 active:scale-[0.98]',
        on
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line-strong text-fg hover:border-fg/40',
      )}
    >
      {on ? <Check size={14} weight="bold" /> : <Plus size={14} />}
      {children}
      {price && (
        <span className={cn('font-mono text-xs', on ? 'text-accent-ink/70' : 'text-faint')}>
          {price}
        </span>
      )}
    </button>
  )
}

function Row({
  label,
  value,
  muted,
  strong,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
  className?: string
}) {
  return (
    <div
      className={cn('flex items-baseline justify-between gap-4', muted && 'text-muted', className)}
    >
      <dt>{label}</dt>
      <dd className={cn('font-mono', strong && 'text-2xl text-accent')}>{value}</dd>
    </div>
  )
}

function Total({ value }: { value: string }) {
  const reduce = useReducedMotion()
  return (
    <div className="mt-1 h-10 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={value}
          initial={reduce ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: -24, opacity: 0 }}
          transition={{ duration: 0.4, ease }}
          className="font-mono text-[clamp(1.4rem,2.3vw,1.9rem)] leading-[1.3] tracking-tight whitespace-nowrap text-accent"
          aria-live="polite"
        >
          {value}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
