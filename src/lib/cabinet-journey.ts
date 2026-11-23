import { z } from 'zod'

// «Путь проекта» (client onboarding, owner 2026-11-24: «клиент явно не знает, что делать после заявки»).
// HQ is the source of truth and sends an optional `journey` in the lead and the project object. The cabinet
// maps the stage to copy (`cabinet.journey`). An old HQ sends only `stage`/`nextStep`: `journeyOf` then
// derives the journey from them, so nothing breaks. Pure, so tests cover parsing, fallback and the stepper.
export const journeyStages = ['received', 'reviewing', 'quote', 'contract', 'invoice', 'paid', 'start', 'stages', 'done', 'lost'] as const
export type JourneyStage = (typeof journeyStages)[number]

// The 9 stages are shown as 6 steps (they fit a 390 px screen).
export const journeySteps = ['received', 'reviewing', 'quote', 'contract', 'pay', 'work'] as const
export type JourneyStep = (typeof journeySteps)[number]
const stepOf: Record<Exclude<JourneyStage, 'lost'>, JourneyStep> = {
  received: 'received',
  reviewing: 'reviewing',
  quote: 'quote',
  contract: 'contract',
  invoice: 'pay',
  paid: 'pay',
  start: 'work',
  stages: 'work',
  done: 'work',
}

export const clientActionKinds = ['accept_quote', 'sign', 'pay', 'accept_stage', 'answer', 'none'] as const
export type ClientActionKind = (typeof clientActionKinds)[number]

export type Bilingual = { ru: string; en: string }
export type JourneyAction = { kind: ClientActionKind; href: string | null; label: Bilingual | null }
export type Journey = {
  stage: JourneyStage
  since: string | null
  eta: string | null
  etaText: Bilingual | null
  clientAction: JourneyAction | null
  answersWhere: string[]
  nextWeWill: Bilingual | null
  // «этап k из N» of the running project (HQ `stageOf`).
  stageOf: { no: number; total: number } | null
}

// A link HQ sends is a path of this site or an https address, never a script.
const safeHref = (v: unknown): string | null =>
  typeof v === 'string' && /^(\/(?!\/)|https:\/\/)[^\s<>"']{0,500}$/.test(v) ? v : null

const text = z.string().trim().min(1).max(400)
const bilingual = z
  .object({ ru: text.optional(), en: text.optional() })
  .transform((v): Bilingual | null => (v.ru || v.en ? { ru: v.ru ?? v.en ?? '', en: v.en ?? v.ru ?? '' } : null))
const lenient = <T>(schema: z.ZodType<T>) => schema.optional().catch(undefined)
const iso = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)))

const journeySchema = z.object({
  stage: z.enum(journeyStages),
  since: lenient(iso),
  eta: lenient(iso),
  etaText: lenient(bilingual),
  clientAction: lenient(
    z.object({
      kind: z.enum(clientActionKinds).catch('none'),
      href: z.unknown().optional(),
      label: lenient(bilingual),
    }),
  ),
  answersWhere: lenient(z.array(z.string().max(20)).max(8)),
  nextWeWill: lenient(bilingual),
  stageOf: lenient(z.object({ no: z.number().int().min(1).max(99), total: z.number().int().min(1).max(99) })),
})

// A tolerant parse: only a known `stage` makes a journey, every other field that is wrong is dropped.
export function parseJourney(value: unknown): Journey | null {
  const r = journeySchema.safeParse(value)
  if (!r.success) return null
  const d = r.data
  return {
    stage: d.stage,
    since: d.since ?? null,
    eta: d.eta ?? null,
    etaText: d.etaText ?? null,
    clientAction: d.clientAction ? { kind: d.clientAction.kind, href: safeHref(d.clientAction.href), label: d.clientAction.label ?? null } : null,
    answersWhere: (d.answersWhere ?? []).filter((c) => /^[a-z_]{2,20}$/.test(c)),
    nextWeWill: d.nextWeWill ?? null,
    stageOf: d.stageOf && d.stageOf.no <= d.stageOf.total ? d.stageOf : null,
  }
}

const fromLeadStage: Record<string, JourneyStage> = {
  new: 'received',
  qualified: 'reviewing',
  proposal: 'quote',
  contract: 'contract',
  paid: 'paid',
  project: 'stages',
  lost: 'lost',
}

// The journey of an old payload: the lead's `stage` (new, qualified, proposal, contract, paid, project, lost),
// and «invoice» when a contract is signed and the next action is paying.
export function deriveJourney(stage: string, nextActionKind?: string | null): Journey {
  let at = fromLeadStage[stage] ?? 'received'
  if (at === 'contract' && nextActionKind === 'pay_stage') at = 'invoice'
  return { stage: at, since: null, eta: null, etaText: null, clientAction: null, answersWhere: [], nextWeWill: null, stageOf: null }
}

export const journeyOf = (x: { journey?: Journey | null; stage: string; nextAction?: { kind: string } | null }): Journey =>
  x.journey ?? deriveJourney(x.stage, x.nextAction?.kind)

export type StepState = 'done' | 'now' | 'next'
// The six steps with their state. `lost` greys everything; `done` ticks everything.
export function journeyTrack(stage: JourneyStage): { steps: { id: JourneyStep; state: StepState }[]; lost: boolean; finished: boolean } {
  const lost = stage === 'lost'
  const finished = stage === 'done'
  const at = lost ? -1 : journeySteps.indexOf(stepOf[stage])
  return {
    lost,
    finished,
    steps: journeySteps.map((id, i) => ({
      id,
      state: lost ? 'next' : finished || i < at ? 'done' : i === at ? 'now' : 'next',
    })),
  }
}

// «Ответ придёт…»: the channels HQ listed, the cabinet and the email when it listed none; unknown names are kept out.
export const knownChannels = ['cabinet', 'email', 'telegram', 'whatsapp', 'instagram', 'phone'] as const
export function answerChannels(answersWhere: readonly string[]): string[] {
  const own = answersWhere.filter((c) => (knownChannels as readonly string[]).includes(c))
  return own.length ? [...new Set(own)] : ['cabinet', 'email']
}

// HQ sends site paths without the locale (`/cabinet?tab=documents&doc=7`): the site adds `/<locale>`.
// An absolute address (the invoice pay link) is left alone, an already localized path too.
export function localizeHref(href: string, locale: 'ru' | 'en'): string {
  if (!href.startsWith('/') || /^\/(ru|en)(\/|\?|#|$)/.test(href)) return href
  return `/${locale}${href}`
}

export const pickText = (b: Bilingual | null | undefined, locale: 'ru' | 'en'): string => (b ? b[locale] || b.ru : '')

// The first-visit tour (3 Fira bubbles): once per account, in localStorage, never throws.
export const tourSteps = ['projects', 'documents', 'messages'] as const
export const tourKey = (account: string) => `fir-cabinet-tour:${account.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'anon'}`
type Store = Pick<Storage, 'getItem' | 'setItem'>
export function tourSeen(store: Store | null, account: string): boolean {
  try {
    return store?.getItem(tourKey(account)) === '1'
  } catch {
    return false
  }
}
export function markTourSeen(store: Store | null, account: string): void {
  try {
    store?.setItem(tourKey(account), '1')
  } catch {
    // Storage blocked: the tour may come back next time, nothing else changes.
  }
}
