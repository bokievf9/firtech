'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import { builderUi, pick } from '@/content/builder-catalog'
import {
  applyKind,
  decodeBuild,
  emptyBuild,
  encodeBuild,
  isStartingSet,
  leadServiceOf,
  productsOnRequest,
  quote,
  toggleProduct,
  withSiteLanguage,
  type Build,
  type BuildExtra,
  type BusinessKind,
  type ProductId,
} from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { leadSummary } from '@/lib/estimate-doc'
import { sendEstimate } from '@/lib/estimate-event'
import type { Locale } from '@/lib/i18n'
import { catalog, formatUsd } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { DetailsStep, StyleStep } from './builder-brief'
import { BottomNav, NextButton, PreviewSheet, StepBar } from './builder-nav'
import { BuilderPreview } from './builder-preview'
import { FeaturesStep, GoalsStep, KindStep, PartsStep, ProductsStep } from './builder-steps'
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
  const steps = pick(builderUi.steps, locale)
  const total = steps.length
  const reduce = useReducedMotion()
  const pathname = usePathname()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [build, setBuildState] = useState<Build>(emptyBuild)
  const [copied, setCopied] = useState(false)
  const [atForm, setAtForm] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [ready, setReady] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  const kind = build.kind ?? null
  const hasParts = Object.keys(build.parts).length > 0
  // Something to quote: parts with prices, or products that are only listed "on quote".
  const hasContent = hasParts || (build.products?.length ?? 0) > 0
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
    let next = asked !== null && asked < total ? asked : fallback
    if (next > PARTS && !parts) next = shared ? PARTS : 0
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL */
    if (shared) setBuildState(shared)
    setStep(next)
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [total])

  // Пульт «Цифры»: the visitor reached the summary (the estimate) of the builder.
  useEffect(() => {
    if (ready && step === SUMMARY) trackEvent('builder_done')
  }, [ready, step])

  // Keep the address in sync with the build and step, without a navigation.
  useEffect(() => {
    if (!ready) return
    window.history.replaceState(window.history.state, '', urlFor(build, step))
  }, [build, step, urlFor, ready])

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

  useEffect(() => {
    const target = document.getElementById('contact')
    if (!target) return
    const io = new IntersectionObserver(([entry]) => setAtForm(entry?.isIntersecting ?? false), {
      rootMargin: '0px 0px -30% 0px',
    })
    io.observe(target)
    return () => io.disconnect()
  }, [])

  // A new screen starts at the top, with focus on its title for keyboard and screen readers.
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    const id = window.setTimeout(() => heading.current?.focus({ preventScroll: true }), reduce ? 0 : 380)
    return () => window.clearTimeout(id)
  }, [step, reduce])

  const setBuild = useCallback((update: (b: Build) => Build) => setBuildState(update), [])
  const closeSheet = useCallback(() => setSheet(false), [])

  const go = useCallback(
    (next: number) => {
      if (next === step || next < 0 || next >= total) return
      setDir(next > step ? 1 : -1)
      setStep(next)
      setSheet(false)
      moved.current = true
      window.history.pushState(window.history.state, '', urlFor(build, next))
      track('builder_step', { step: next + 1 })
    },
    [build, step, total, urlFor],
  )

  const canGo = step === 0 ? kind !== null || hasContent : step >= PARTS ? hasContent : true
  const last = step === SUMMARY

  function pickKind(next: BusinessKind) {
    // The preset replaces the kind, products and parts; goals, style and details already given stay.
    setBuildState((b) => applyKind(b, next))
    go(PRODUCTS)
  }

  function pickProduct(id: ProductId) {
    setBuildState((b) => toggleProduct(b, id))
  }

  function toggleService(slug: ServiceSlug) {
    setBuildState((b) => {
      const parts = { ...b.parts }
      if (parts[slug]) delete parts[slug]
      else parts[slug] = { variant: Object.keys(catalog[slug].variants)[0] ?? '', addons: [] }
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

  function handOff() {
    const service = leadServiceOf(build)
    sendEstimate({ service, summary: leadSummary(build, dict, locale) })
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
      go(step + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canGo, go, last, sheet, step])

  const q = quote(build)
  const preview = withPreview.has(step)
  const ui = builderUi
  const titles = [
    { title: pick(ui.kindTitle, locale), sub: `${pick(ui.kindSub, locale)} ${pick(ui.intro, locale)}` },
    { title: pick(ui.productsTitle, locale), sub: pick(ui.productsSub, locale) },
    { title: t.goalsTitle, sub: t.goalsSub },
    { title: t.partsTitle, sub: t.partsSub },
    { title: t.featuresTitle, sub: t.featuresSub },
    { title: pick(ui.styleTitle, locale), sub: pick(ui.styleSub, locale) },
    { title: t.detailsTitle, sub: t.detailsSub },
    { title: t.summaryTitle, sub: t.summarySub },
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
                title={screen.title}
                sub={screen.sub}
              >
                {step === 0 && (
                  <KindStep locale={locale} kind={kind} onPick={pickKind} />
                )}
                {step === PRODUCTS && (
                  <ProductsStep locale={locale} build={build} onToggle={pickProduct} />
                )}
                {step === 2 && <GoalsStep dict={dict} build={build} setBuild={setBuild} />}
                {step === PARTS && (
                  <PartsStep
                    dict={dict}
                    build={build}
                    onToggle={toggleService}
                    onVariant={setVariant}
                  />
                )}
                {step === 4 && (
                  <FeaturesStep
                    dict={dict}
                    build={build}
                    onAddon={toggleAddon}
                    onExtra={toggleExtra}
                  />
                )}
                {step === STYLE && (
                  <StyleStep dict={dict} locale={locale} build={build} setBuild={setBuild} />
                )}
                {step === 6 && <DetailsStep dict={dict} build={build} setBuild={setBuild} />}
                {step === SUMMARY &&
                  (hasContent ? (
                    <SummaryStep
                      dict={dict}
                      locale={locale}
                      build={build}
                      estimateHref={`${pathname}/estimate?b=${encodeBuild(build)}`}
                      copied={copied}
                      onSend={handOff}
                      onCopy={copyLink}
                      onEdit={go}
                    />
                  ) : (
                    <div className="grid justify-items-start gap-5">
                      <p className="text-muted">{t.pickOne}</p>
                      <button type="button" onClick={() => go(PARTS)} className={buttonStyles.primary}>
                        {t.partsTitle}
                      </button>
                    </div>
                  ))}
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
            <p className="truncate font-mono text-sm text-accent md:text-base" aria-live="polite">
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
            hasContent && <NextButton label={t.send} onClick={handOff} />
          ) : (
            <NextButton label={t.next} disabled={!canGo} onClick={() => go(step + 1)} />
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
