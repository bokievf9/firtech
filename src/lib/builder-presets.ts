import { presetCopy, presetIds, needWords, type NeedId, type PresetId } from '../content/builder-presets'
import { emptyBuild, applyKind, cleanTask, quote, toggleProduct, type Build, type BusinessKind } from './builder'
import { agentQuote, toggleAgent } from './builder-agent'
import type { StandaloneAgentId } from './agent-ids'
import { defaultPricing, type Pricing } from './pricing'

export { presetIds, type PresetId, type NeedId }

// Niche presets (builder v6 wave 2): a preset is a prebuilt `Build`: the niche's starting set (kind, products, parts) plus
// agent lines, with `preset: <id>` in it. It travels in the same `?b=` link as any build, so a shared preset link opens on
// the summary, editable. Prices are counted from the live pricing, never written down.

const kindOf: Record<PresetId, BusinessKind> = {
  cafe: 'cafe',
  salon: 'salon',
  shop: 'shop',
  delivery: 'delivery',
  services: 'services',
  clinic: 'clinic',
  auto: 'carservice',
  school: 'onlineschool',
}

export const presetAgents: Record<PresetId, StandaloneAgentId[]> = {
  cafe: ['content-maker', 'lead-handler'],
  salon: ['lead-handler'],
  shop: ['lead-handler', 'support'],
  delivery: ['lead-handler', 'support'],
  services: ['lead-handler', 'billing'],
  clinic: ['lead-handler', 'support'],
  auto: ['lead-handler', 'billing'],
  school: ['support', 'onboarding'],
}

export const isPresetId = (value: string | null | undefined): value is PresetId => (presetIds as readonly string[]).includes(value ?? '')

// The prebuilt build of a preset. `keep` carries what the visitor already gave (details, discovery) over.
export function presetBuild(id: PresetId, keep: Pick<Build, 'details' | 'discovery' | 'task'> = {}): Build {
  let build = applyKind(emptyBuild, kindOf[id])
  for (const agent of presetAgents[id]) build = toggleAgent(build, agent)
  return {
    ...build,
    ...(keep.details ? { details: keep.details } : {}),
    ...(keep.discovery ? { discovery: keep.discovery } : {}),
    ...(keep.task ? { task: keep.task } : {}),
    preset: id,
  }
}

export type PresetPrice = { oneTime: number; monthly: number }
// One-time total (parts + the agents' setup) and the monthly part (extras and agent subscriptions), from `pricing`.
export function presetPrice(id: PresetId, pricing: Pricing = defaultPricing): PresetPrice {
  const build = presetBuild(id)
  const q = quote(build, pricing)
  const aq = agentQuote(build, pricing)
  return { oneTime: q.total + (aq?.oneTime ?? 0), monthly: (q.monthly ?? 0) + (aq?.monthly ?? 0) }
}

// ---------------------------------------------------------------- the matcher

export type Match =
  | { kind: 'preset'; id: PresetId; score: number; reason: { ru: string; en: string } }
  | { kind: 'need'; id: NeedId; score: number; reason: { ru: string; en: string } }

const norm = (text: string) => text.toLowerCase().replace(/ё/g, 'е')
// `\b` does not see Cyrillic, so a word end is spelled out. A fragment matches from the start of a word.
const compile = (fragment: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${fragment.replace(/\\b/g, '(?![\\p{L}\\p{N}])')})`, 'u')
const compiled = new Map<string, RegExp>()
const hit = (text: string, fragment: string) => {
  let re = compiled.get(fragment)
  if (!re) compiled.set(fragment, (re = compile(fragment)))
  return re.test(text)
}
const count = (text: string, fragments: readonly string[]) => fragments.filter((f) => hit(text, f)).length

// What each niche usually needs, so «запись» tips a tie toward the salon rather than the shop.
const flavor: Record<PresetId, NeedId[]> = {
  cafe: ['adminbot', 'content'],
  salon: ['adminbot', 'intake'],
  shop: ['intake', 'miniapp'],
  delivery: ['miniapp', 'automation'],
  services: ['intake', 'automation'],
  clinic: ['adminbot'],
  auto: ['adminbot'],
  school: ['intake'],
}

// The best preset or product for a free-text task, RU and EN, or null. A niche word weighs 3, a need word 1 for a niche that
// usually has it, 2 as a product on its own. A niche needs a niche word; a product needs two need words or one clear one.
export function matchPreset(text: string): Match | null {
  const t = norm(text).slice(0, 500)
  if (t.trim().length < 3) return null
  const needs = Object.fromEntries((Object.keys(needWords) as NeedId[]).map((id) => [id, count(t, needWords[id].words)])) as Record<NeedId, number>
  let best: Match | null = null
  for (const id of presetIds) {
    const niche = count(t, presetCopy[id].words.map(norm))
    if (!niche) continue
    const score = 3 * niche + flavor[id].reduce((sum, n) => sum + Math.min(needs[n], 1), 0)
    if (!best || score > best.score) {
      const c = presetCopy[id]
      best = {
        kind: 'preset',
        id,
        score,
        reason: {
          ru: `${c.name.ru.toLowerCase()}: ${c.reason.ru}`,
          en: `${c.name.en.toLowerCase()}: ${c.reason.en}`,
        },
      }
    }
  }
  if (best) return best
  for (const id of Object.keys(needWords) as NeedId[]) {
    const score = 2 * needs[id]
    if (score >= 2 && (!best || score > best.score)) best = { kind: 'need', id, score, reason: needWords[id].reason }
  }
  return best
}

const needProduct: Record<Exclude<NeedId, 'personal'>, Parameters<typeof toggleProduct>[1]> = {
  adminbot: 'adminbot',
  intake: 'intake',
  automation: 'automation',
  content: 'content',
  miniapp: 'miniapp',
}

// The build a match proposes. A product match is the product alone (personal is a path, not a build: see `isPersonalMatch`).
export function matchBuild(match: Match, task?: string): Build {
  const keep = { ...(task ? { task: cleanTask(task) } : {}) }
  if (match.kind === 'preset') return presetBuild(match.id, keep)
  if (match.id === 'personal') return { ...emptyBuild, ...keep }
  return { ...toggleProduct(emptyBuild, needProduct[match.id]), ...keep }
}

export const isPersonalMatch = (match: Match) => match.kind === 'need' && match.id === 'personal'
