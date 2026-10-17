'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import {
  decodeBuild,
  emptyBuild,
  encodeBuild,
  leadServiceOf,
  presets,
  quote,
  type Build,
  type BuildExtra,
  type BusinessKind,
} from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { formatRange, leadSummary } from '@/lib/estimate-doc'
import { sendEstimate } from '@/lib/estimate-event'
import type { Locale } from '@/lib/i18n'
import { catalog, formatUsd } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { DetailsStep, StyleStep } from './builder-brief'
import { BottomNav, NextButton, PreviewSheet, StepBar } from './builder-nav'
import { BuilderPreview } from './builder-preview'
import { FeaturesStep, GoalsStep, KindStep, PartsStep } from './builder-steps'
import { SummaryStep } from './builder-summary'
import { Screen } from './builder-ui'

const ease = [0.16, 1, 0.3, 1] as const

// Screens: 0 business, 1 goal, 2 parts, 3 features, 4 style, 5 details, 6 summary.
const PARTS = 2
const STYLE = 4
const SUMMARY = 6
// Screens where the live mockup sits next to the content.
const withPreview = new Set([2, 3, 4])

// Each step is its own screen. The step lives in the URL (`?b=...&s=3`, 1-based) and in history,
// so refresh and the browser Back button work while the page itself stays static.
export function Builder({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.builder
  const total = t.steps.length
  const reduce = useReducedMotion()
  const pathname = usePathname()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [kind, setKind] = useState<BusinessKind | null>(null)
  const [build, setBuildState] = useState<Build>(emptyBuild)
  const [copied, setCopied] = useState(false)
  const [atForm, setAtForm] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [ready, setReady] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  const hasParts = Object.keys(build.parts).length > 0
  const reachable = useCallback((i: number) => i <= PARTS || hasParts, [hasParts])

  const urlFor = useCallback(
    (b: Build, s: number) => {
      const code = encodeBuild(b)
      const query = [code && `b=${code}`, s > 0 && `s=${s + 1}`].filter(Boolean).join('&')
      return query ? `${pathname}?${query}` : pathname
    },
    [pathname],
  )

  // Read after mount: the page is static, so the server never sees the query string. A shared
  // link without a step opens on the summary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = decodeBuild(params.get('b'))
    const asked = Number(params.get('s')) - 1
    const parts = shared ? Object.keys(shared.parts).length > 0 : false
    let next = Number.isInteger(asked) && asked >= 0 && asked < total ? asked : shared ? SUMMARY : 0
    if (next > PARTS && !parts) next = shared ? PARTS : 0
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL */
    if (shared) setBuildState(shared)
    setStep(next)
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [total])

  // Keep the address in sync with the build and step, without a navigation.
  useEffect(() => {
    if (!ready) return
    window.history.replaceState(window.history.state, '', urlFor(build, step))
  }, [build, step, urlFor, ready])

  // Browser Back and Forward walk the steps.
  useEffect(() => {
    function onPop() {
      const s = Number(new URLSearchParams(window.location.search).get('s')) - 1
      const next = Number.isInteger(s) && s >= 0 && s < total ? s : 0
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

  const canGo = step === 0 ? kind !== null || hasParts : step >= PARTS ? hasParts : true
  const last = step === SUMMARY

  function pickKind(next: BusinessKind) {
    setKind(next)
    // The preset replaces the parts; goals, style and details already given stay.
    setBuildState((b) => ({ ...b, ...structuredClone(presets[next]) }))
    go(1)
  }

  function toggleService(slug: ServiceSlug) {
    setBuildState((b) => {
      const parts = { ...b.parts }
      if (parts[slug]) delete parts[slug]
      else parts[slug] = { variant: Object.keys(catalog[slug].variants)[0] ?? '', addons: [] }
      return { ...b, parts }
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
  const titles = [
    { title: t.kindTitle, sub: `${t.sub} ${t.intro}` },
    { title: t.goalsTitle, sub: t.goalsSub },
    { title: t.partsTitle, sub: t.partsSub },
    { title: t.featuresTitle, sub: t.featuresSub },
    { title: t.styleTitle, sub: t.styleSub },
    { title: t.detailsTitle, sub: t.detailsSub },
    { title: t.summaryTitle, sub: t.summarySub },
  ] as const
  const screen = titles[step] ?? titles[0]

  return (
    <div data-builder className="relative">
      <StepBar
        eyebrow={t.eyebrow}
        title={t.title}
        steps={t.steps}
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
                  <KindStep dict={dict} locale={locale} kind={kind} onPick={pickKind} />
                )}
                {step === 1 && <GoalsStep dict={dict} build={build} setBuild={setBuild} />}
                {step === PARTS && (
                  <PartsStep
                    dict={dict}
                    build={build}
                    onToggle={toggleService}
                    onVariant={setVariant}
                  />
                )}
                {step === 3 && (
                  <FeaturesStep
                    dict={dict}
                    build={build}
                    onAddon={toggleAddon}
                    onExtra={toggleExtra}
                  />
                )}
                {step === STYLE && <StyleStep dict={dict} build={build} setBuild={setBuild} />}
                {step === 5 && <DetailsStep dict={dict} build={build} setBuild={setBuild} />}
                {step === SUMMARY &&
                  (hasParts ? (
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
                  <BuilderPreview build={build} dict={dict} className="min-h-[520px]" />
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
              {hasParts ? formatRange(q.total) : ''}
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
            hasParts && <NextButton label={t.send} onClick={handOff} />
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
        <BuilderPreview build={build} dict={dict} />
      </PreviewSheet>
    </div>
  )
}
