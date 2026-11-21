'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import { builderUi, pick } from '@/content/builder-catalog'
import { detailsUi, faceUi, issueText, themeUi } from '@/content/builder-v2'
import {
  applyKind,
  decodeBuild,
  emptyBuild,
  encodeBuild,
  isStartingSet,
  productsOnRequest,
  quote,
  toggleProduct,
  withSiteLanguage,
  type Build,
  type BuildExtra,
  type BusinessKind,
  type DeliveryChannel,
  type ProductId,
  type SiteNeed,
} from '@/lib/builder'
import {
  applySiteNeed,
  hasContentOf,
  reapplySiteNeed,
  stepIssues,
  toggleDelivery,
} from '@/lib/builder-v2'
import { buttonStyles, cn } from '@/lib/cn'
import { hasDraftFlag } from '@/lib/lead-draft'
import type { Locale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { usePricing } from './pricing-provider'
import type { ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { BUILDER_STEP_EVENT } from './chat/chat-events'
import { DetailsStep, ThemeStep } from './builder-brief'
import { BottomNav, NextButton, PreviewSheet, StepBar } from './builder-nav'
import { BuilderPreview } from './builder-preview'
import { FeaturesStep, GoalsStep, KindStep, ProductsStep, SetStep } from './builder-steps'
import { SummaryStep } from './builder-summary'
import { Screen } from './builder-ui'

const ease = [0.16, 1, 0.3, 1] as const

// Screens: 0 business, 1 products, 2 goal, 3 parts, 4 features, 5 style, 6 details, 7 summary.
const PRODUCTS = 1
const PARTS = 3
const STYLE = 5
const SUMMARY = 7
// Screens where the live mockup sits next to the content.
const withPreview = new Set([1, 3, 4, 5])
// Links from before the products step used `?s=` with seven steps: where each of them lands now.
const legacyStep = [0, 2, 3, 4, 5, 6, 7]

// Each step is its own screen. The step lives in the URL (`?b=...&step=3`, 1-based) and in history,
// so refresh and the browser Back button work while the page itself stays static.
export function Builder({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.builder
  const steps = pick(faceUi.steps, locale)
  const total = steps.length
  const reduce = useReducedMotion()
  const pricing = usePricing()
  const pathname = usePathname()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [build, setBuildState] = useState<Build>(emptyBuild)
  const [copied, setCopied] = useState(false)
  const [atForm, setAtForm] = useState(false)
  // Back from sign-in (`draft=1`) or an old `#contact` link: the last step scrolls to its send button.
  const [cameBack, setCameBack] = useState(false)
  const [focusSend, setFocusSend] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [ready, setReady] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const focusNext = useRef(false)
  const moved = useRef(false)
  // The new screen mounts after the old one has left (AnimatePresence "wait"), so its title is
  // focused the moment it mounts instead of on a timer that can fire before that.
  const heading = useCallback((el: HTMLHeadingElement | null) => {
    if (!el || !focusNext.current) return
    focusNext.current = false
    el.focus({ preventScroll: true })
  }, [])

  const kind = build.kind ?? null
  const hasParts = Object.keys(build.parts).length > 0
  // Something to quote: parts with prices, or products that are only listed "on quote".
  const hasContent = hasContentOf(build)
  const onRequest = productsOnRequest(build)
  const reachable = useCallback((i: number) => i <= PARTS || hasContent, [hasContent])

  const urlFor = useCallback(
    (b: Build, s: number) => {
      const code = encodeBuild(b)
      const query = [code && `b=${code}`, s > 0 && `step=${s + 1}`].filter(Boolean).join('&')
      return query ? `${pathname}?${query}` : pathname
    },
    [pathname],
  )

  // Read after mount: the page is static, so the server never sees the query string. A shared
  // link without a step opens on the summary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = decodeBuild(params.get('b'))
    const asked = stepFromQuery(params)
    const parts = shared ? Object.keys(shared.parts).length > 0 || Boolean(shared.products) : false
    // A card's starting set (kind preset or product, no step) opens on the products step, a
    // shared finished build on the summary.
    const fallback = shared ? (isStartingSet(shared) ? PRODUCTS : SUMMARY) : 0
    const wantsSend = window.location.hash === '#contact'
    const back = hasDraftFlag(window.location.search)
    let next = asked !== null && asked < total ? asked : fallback
    // An old link to #contact opens the step that holds the send button, when there is a project to send.
    if (wantsSend && parts && asked === null) next = SUMMARY
    if (next > PARTS && !parts) next = shared ? PARTS : 0
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL */
    if (shared) setBuildState(shared)
    setCameBack(back)
    setFocusSend(wantsSend)
    setStep(next)
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [total])

  // Пульт «Цифры»: the visitor reached the summary (the estimate) of the builder.
  useEffect(() => {
    if (ready && step === SUMMARY) trackEvent('builder_done')
  }, [ready, step])

  // The chat launcher stays hidden on the builder until the last step.
  useEffect(() => {
    if (!ready) return
    window.dispatchEvent(new CustomEvent(BUILDER_STEP_EVENT, { detail: { last: step === SUMMARY } }))
  }, [ready, step])

  // Keep the address in sync with the build and step, without a navigation.
  useEffect(() => {
    if (!ready) return
    window.history.replaceState(window.history.state, '', urlFor(build, step))
  }, [build, step, urlFor, ready])

  // Back and Forward land on the top of a step, not on the scroll position the browser remembers.
  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])

  // Browser Back and Forward walk the steps.
  useEffect(() => {
    function onPop() {
      const s = stepFromQuery(new URLSearchParams(window.location.search))
      const next = s !== null && s < total ? s : 0
      setStep((prev) => {
        setDir(next >= prev ? 1 : -1)
        return next
      })
      moved.current = true
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [total])

  // The send button sits in the last step (it mounts after the screen animation): the bottom bar steps
  // aside while it is on screen.
  useEffect(() => {
    let io: IntersectionObserver | undefined
    let timer = 0
    let tries = 0
    const attach = () => {
      const target = document.getElementById('contact')
      if (target) {
        io = new IntersectionObserver(([entry]) => setAtForm(entry?.isIntersecting ?? false), {
          rootMargin: '0px 0px -30% 0px',
        })
        io.observe(target)
      } else if (tries++ < 20) timer = window.setTimeout(attach, 100)
    }
    attach()
    return () => {
      io?.disconnect()
      window.clearTimeout(timer)
      setAtForm(false)
    }
  }, [step, ready])

  // A new screen starts at the top, with focus on its title for keyboard and screen readers.
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    focusNext.current = true
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [step, reduce])

  const setBuild = useCallback((update: (b: Build) => Build) => setBuildState(update), [])
  const closeSheet = useCallback(() => setSheet(false), [])

  const go = useCallback(
    (next: number) => {
      if (next === step || next < 0 || next >= total) return
      setDir(next > step ? 1 : -1)
      setStep(next)
      setAttempted(false)
      setSheet(false)
      moved.current = true
      window.history.pushState(window.history.state, '', urlFor(build, next))
      track('builder_step', { step: next + 1 })
    },
    [build, step, total, urlFor],
  )

  const issues = stepIssues(build, step)
  const canGo = issues.length === 0
  const last = step === SUMMARY

  function pickKind(next: BusinessKind) {
    // The preset replaces the kind, products and parts; goals, style and details already given stay.
    setBuildState((b) => reapplySiteNeed(applyKind(b, next)))
    go(PRODUCTS)
  }

  function pickProduct(id: ProductId) {
    setBuildState((b) => reapplySiteNeed(toggleProduct(b, id)))
  }

  function pickSiteNeed(need: SiteNeed) {
    setBuildState((b) => applySiteNeed(b, need))
  }

  function pickDelivery(id: DeliveryChannel) {
    setBuildState((b) => toggleDelivery(b, id))
  }

  // «Дальше» with something missing explains what, instead of staying silent.
  const next = useCallback(() => {
    if (!canGo) {
      setAttempted(true)
      requestAnimationFrame(() => document.getElementById('builder-issue')?.focus())
      return
    }
    go(step + 1)
  }, [canGo, go, step])

  function toggleService(slug: ServiceSlug) {
    setBuildState((b) => {
      const parts = { ...b.parts }
      if (parts[slug]) delete parts[slug]
      else parts[slug] = { variant: Object.keys(pricing.catalog[slug].variants)[0] ?? '', addons: [] }
      return withSiteLanguage({ ...b, parts })
    })
  }

  function setVariant(slug: ServiceSlug, variant: string) {
    setBuildState((b) => {
      const part = b.parts[slug]
      return part ? { ...b, parts: { ...b.parts, [slug]: { ...part, variant } } } : b
    })
  }

  function toggleAddon(slug: ServiceSlug, id: string) {
    setBuildState((b) => {
      const part = b.parts[slug]
      if (!part) return b
      const addons = part.addons.includes(id)
        ? part.addons.filter((a) => a !== id)
        : [...part.addons, id]
      return { ...b, parts: { ...b.parts, [slug]: { ...part, addons } } }
    })
  }

  function toggleExtra(id: BuildExtra) {
    setBuildState((b) => ({
      ...b,
      extras: b.extras.includes(id) ? b.extras.filter((e) => e !== id) : [...b.extras, id],
    }))
  }

  // The bottom bar's button on the last step brings the send block (the real button) into view.
  function scrollToSend() {
    document.getElementById('contact')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
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

  // Enter moves on, except where Enter already means something (buttons, links, text areas).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || e.isComposing)
        return
      if (sheet || last || !canGo) return
      const el = e.target as HTMLElement | null
      if (el?.closest('button, a, textarea, select, [role="dialog"]')) return
      if (el && el !== document.body && !el.closest('[data-builder]')) return
      e.preventDefault()
      next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canGo, go, last, sheet, step, next])

  const q = quote(build, pricing)
  const preview = withPreview.has(step)
  const ui = builderUi
  const titles = [
    { title: pick(faceUi.explainTitle, locale), sub: pick(faceUi.explain, locale) },
    { title: pick(faceUi.productsTitle, locale), sub: pick(faceUi.productsSub, locale) },
    { title: pick(faceUi.goalsTitle, locale), sub: pick(faceUi.goalsSub, locale) },
    { title: pick(faceUi.partsTitle, locale), sub: pick(faceUi.partsSub, locale) },
    { title: pick(faceUi.featuresTitle, locale), sub: pick(faceUi.featuresSub, locale) },
    { title: pick(themeUi.title, locale), sub: pick(themeUi.sub, locale) },
    { title: pick(detailsUi.title, locale), sub: pick(detailsUi.sub, locale) },
    { title: pick(faceUi.previewTitle, locale), sub: '' },
  ] as const
  const screen = titles[step] ?? titles[0]

  return (
    <div data-builder className="relative">
      <StepBar
        eyebrow={t.eyebrow}
        title={t.title}
        steps={steps}
        step={step}
        reachable={reachable}
        onGo={go}
      />

      <div className="mx-auto min-h-[calc(100dvh-10rem)] max-w-7xl overflow-x-clip px-4 pt-10 pb-36 md:px-8 md:pt-14 md:pb-40">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 56 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 * dir }}
            transition={{ duration: reduce ? 0.12 : 0.38, ease }}
            className={cn(
              preview && 'grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:gap-16',
            )}
          >
            <div className="min-w-0">
              <Screen
                ref={heading}
                index={step}
                total={total}
                label={t.stepLabel}
                of={t.of}
                title={screen.title}
                sub={screen.sub}
              >
                {step === 0 && (
                  <KindStep locale={locale} kind={kind} onPick={pickKind} />
                )}
                {step === PRODUCTS && (
                  <ProductsStep
                    locale={locale}
                    build={build}
                    onToggle={pickProduct}
                    onSiteNeed={pickSiteNeed}
                  />
                )}
                {step === 2 && <GoalsStep locale={locale} build={build} setBuild={setBuild} />}
                {step === PARTS && (
                  <SetStep
                    dict={dict}
                    locale={locale}
                    build={build}
                    onToggle={toggleService}
                    onVariant={setVariant}
                    onDelivery={pickDelivery}
                  />
                )}
                {step === 4 && (
                  <FeaturesStep
                    dict={dict}
                    locale={locale}
                    build={build}
                    onAddon={toggleAddon}
                    onExtra={toggleExtra}
                  />
                )}
                {step === STYLE && (
                  <ThemeStep dict={dict} locale={locale} build={build} setBuild={setBuild} />
                )}
                {step === 6 && (
                  <DetailsStep
                    dict={dict}
                    locale={locale}
                    build={build}
                    setBuild={setBuild}
                    showErrors={attempted}
                  />
                )}
                {step === SUMMARY &&
                  (hasContent ? (
                    <SummaryStep
                      dict={dict}
                      locale={locale}
                      build={build}
                      estimateHref={`${pathname}/estimate?b=${encodeBuild(build)}`}
                      copied={copied}
                      cameBack={cameBack}
                      focusSend={focusSend}
                      onCopy={copyLink}
                      onEdit={go}
                    />
                  ) : (
                    <div className="grid justify-items-start gap-5">
                      <p className="text-muted">{t.pickOne}</p>
                      <button type="button" onClick={() => go(PRODUCTS)} className={buttonStyles.primary}>
                        {pick(faceUi.productsTitle, locale)}
                      </button>
                    </div>
                  ))}
                {!last && issues.length > 0 && (
                  <p
                    id="builder-issue"
                    tabIndex={-1}
                    role="status"
                    className={cn(
                      'mt-8 flex max-w-[60ch] items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-snug outline-none',
                      attempted ? 'border-danger/60 bg-danger/[0.06] text-fg' : 'border-line bg-surface text-muted',
                    )}
                  >
                    <span aria-hidden="true" className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', attempted ? 'bg-danger' : 'bg-faint')} />
                    <span>
                      {pick(faceUi.required, locale)}:{' '}
                      {issues.map((id) => pick(issueText[id]!, locale)).join('. ')}
                    </span>
                  </p>
                )}
              </Screen>
            </div>

            {preview && (
              <aside className="hidden min-w-0 lg:block">
                <div className="sticky top-44 grid gap-3">
                  <p className="text-sm text-muted">{t.previewLabel}</p>
                  <BuilderPreview build={build} dict={dict} locale={locale} className="min-h-[520px]" />
                </div>
              </aside>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav
        show={!atForm}
        backLabel={t.back}
        onBack={step > 0 ? () => go(step - 1) : undefined}
        previewLabel={preview ? t.showPreview : undefined}
        onPreview={preview ? () => setSheet(true) : undefined}
        center={
          <div className="min-w-0">
            <p className="hidden text-[11px] text-faint sm:block">
              {t.stepLabel} {step + 1} {t.of} {total}
              {!last && canGo && <span className="hidden lg:inline"> · {t.enterHint}</span>}
            </p>
            <p className="truncate font-mono text-sm text-accent-text md:text-base" aria-live="polite">
              {hasParts ? formatUsd(q.total) : onRequest.length ? pick(ui.totalOnRequest, locale) : ''}
              {hasParts && onRequest.length > 0 && (
                <span className="hidden text-muted sm:inline">
                  {' '}
                  + {pick(ui.totalOnRequest, locale)}
                </span>
              )}
              {hasParts && q.monthly !== null && (
                <span className="hidden text-muted sm:inline">
                  {' '}
                  + {formatUsd(q.monthly)}
                  {t.perMonth}
                </span>
              )}
            </p>
          </div>
        }
        primary={
          last ? (
            hasContent && <NextButton label={pick(faceUi.send, locale)} onClick={scrollToSend} />
          ) : (
            <NextButton label={t.next} blocked={!canGo} onClick={next} />
          )
        }
      />

      <PreviewSheet
        open={sheet}
        title={t.previewLabel}
        closeLabel={t.close}
        onClose={closeSheet}
      >
        <BuilderPreview build={build} dict={dict} locale={locale} />
      </PreviewSheet>
    </div>
  )
}

// The step from the address: `step` (1-based) or the older `s`, which counted seven steps.
function stepFromQuery(params: URLSearchParams): number | null {
  const now = Number(params.get('step')) - 1
  if (params.has('step') && Number.isInteger(now) && now >= 0) return now
  const old = Number(params.get('s')) - 1
  if (params.has('s') && Number.isInteger(old) && old >= 0) return legacyStep[old] ?? null
  return null
}
