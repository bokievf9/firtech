import type { Dict } from '../content/ru'
import en from '../content/en'
import ru from '../content/ru'
import { decodeBuild, type Build } from './builder'
import { resolveLook } from './builder-style'
import { estimateDoc, type BriefRow, type EstimateDoc } from './estimate-doc'
import { defaultPricing, type Pricing } from './pricing'

// «Разбор заявки» (2026-11-22): what a client ordered in the builder, read back from the lead.
// A lead carries the builder link (`?b=` code) in its text or as a separate field, and the quote
// as text. Pure and server-safe: the code goes through the same `decodeBuild` and `estimateDoc` the
// public estimate page uses, so the owner sees the numbers the client saw (at the current price list).
// Old links (parts and extras only), broken codes and leads without any link all give a usable result.

export type BreakdownInput = {
  // The lead's own quote text (`estimate`) and the client's words (`message`).
  estimate?: string | null
  message?: string | null
  // A builder link or a bare code, when HQ sends it as its own field.
  builderUrl?: string | null
  locale?: string | null
}

export type StyleSwatch = { mode: 'dark' | 'light'; bg: string; surface: string; accent: string; fg: string; look: string | null }

export type Breakdown = {
  locale: 'ru' | 'en'
  // The `?b=` code found, and the build decoded from it (null for a broken or missing one).
  code: string | null
  build: Build | null
  // The link carried only parts and extras: no kind, goals, style or details.
  oldLink: boolean
  estimateHref: string | null
  buildHref: string | null
  doc: EstimateDoc | null
  // Niche, products, goals and channels, details: every answer as «question: answer».
  answers: BriefRow[]
  style: BriefRow[]
  swatch: StyleSwatch | null
  message: string
  estimateText: string
  // Something to show at all.
  empty: boolean
}

const dictOf = (locale: 'ru' | 'en'): Dict => (locale === 'ru' ? ru : en)
const lang = (v: string | null | undefined): 'ru' | 'en' | null => (v === 'ru' || v === 'en' ? v : null)

// `...?b=websites.landing~k.cafe&x=1`, `.../builder/estimate?b=...` or a bare code.
const CODE_IN_TEXT = /[?&]b=([\w.~%-]{1,2000})/
const LINK_LOCALE = /\/(ru|en)\/builder/

export function findBuildCode(...sources: (string | null | undefined)[]): { code: string; locale: 'ru' | 'en' | null } | null {
  for (const src of sources) {
    if (!src) continue
    const m = CODE_IN_TEXT.exec(src)
    if (m) {
      let code = m[1]!
      try {
        code = decodeURIComponent(code)
      } catch {}
      return { code, locale: lang(LINK_LOCALE.exec(src)?.[1]) }
    }
  }
  return null
}

// A field that holds only the code (no `?b=`): letters, digits and the code's own separators.
const bareCode = (v: string | null | undefined) => {
  const t = v?.trim()
  return t && /^[\w.~-]{3,2000}$/.test(t) ? { code: t, locale: null } : null
}

export function leadBreakdown(input: BreakdownInput, pricing: Pricing = defaultPricing): Breakdown {
  const message = (input.message ?? '').trim()
  const estimateText = (input.estimate ?? '').trim()
  const found = findBuildCode(input.builderUrl, estimateText, message) ?? bareCode(input.builderUrl)
  const locale = found?.locale ?? lang(input.locale) ?? 'ru'
  const build = found ? decodeBuild(found.code) : null
  const out: Breakdown = {
    locale,
    code: found?.code ?? null,
    build,
    oldLink: false,
    estimateHref: null,
    buildHref: null,
    doc: null,
    answers: [],
    style: [],
    swatch: null,
    message,
    estimateText,
    empty: !message && !estimateText && !found,
  }
  if (!build || !found) return out

  const dict = dictOf(locale)
  const doc = estimateDoc(build, dict, locale, pricing)
  const hasBrief = Boolean(build.kind || build.products?.length || build.goals?.length || build.channels?.length || build.style || build.details)
  out.doc = doc
  out.oldLink = !hasBrief
  out.estimateHref = `/${locale}/builder/estimate?b=${found.code}`
  out.buildHref = `/${locale}/builder?b=${found.code}`
  const kindLabel = locale === 'ru' ? 'Ниша' : 'Niche'
  const productsLabel = locale === 'ru' ? 'Продукты' : 'Products'
  out.answers = [
    ...(doc.kind ? [{ id: 'kind', label: kindLabel, value: doc.kind }] : []),
    ...(doc.products.length ? [{ id: 'products', label: productsLabel, value: doc.products.join(', ') }] : []),
    ...doc.brief.goals,
    ...doc.brief.setup,
    ...doc.brief.details,
  ]
  out.style = doc.brief.style
  if (build.style && Object.keys(build.style).length) {
    const look = resolveLook(build.style)
    const c = look.colors
    out.swatch = { mode: c.mode, bg: c.bg, surface: c.surface, accent: c.accent, fg: c.fg, look: doc.brief.style.find((r) => r.id === 'look')?.value ?? null }
  }
  out.empty = false
  return out
}
