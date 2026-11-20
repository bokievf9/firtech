import { z } from 'zod'
import ru from '../content/ru'
import {
  agentPlanList,
  contentPlanList,
  defaultPricing,
  stageDefs,
  stageIds,
  stageTemplateIds,
  type Pricing,
  type StageTemplateId,
} from './pricing'
import { serviceSlugs } from './site'

// Pure logic of the price editor (no I/O, tested in tests/pricing-store.test.mjs): the list of
// editable prices with their labels and limits, merging the owner's overrides into the defaults,
// validation, and the edit operations with their history. The store (pricing-store.ts) persists it.

export type PriceUnit = 'usd' | 'usd_month' | 'percent'
export type PriceGroup = 'start' | 'kinds' | 'options' | 'extras' | 'plans' | 'discounts' | 'stages'

export type PriceField = {
  path: string
  label: string
  group: PriceGroup
  // Sub-heading inside a group (a service, a template), for the tables.
  section: string
  unit: PriceUnit
  min: number
  max: number
  step: number
  def: number
}

export type Overrides = Record<string, unknown>
export type HistoryEntry = { at: string; path: string; from: number; to: number; by: string }
export type PricesState = { overrides: Overrides; updatedAt: string | null; history: HistoryEntry[] }

export const HISTORY_MAX = 200
export const emptyPrices = (): PricesState => ({ overrides: {}, updatedAt: null, history: [] })

export const groupTitles: Record<PriceGroup, string> = {
  start: 'Старт-цены',
  kinds: 'Конструктор по видам',
  options: 'Опции',
  extras: 'Допы',
  plans: 'Подписки',
  discounts: 'Скидки и реферал',
  stages: 'Этапы оплаты',
}

const serviceNames: Record<string, string> = Object.fromEntries(
  serviceSlugs.map((s) => [s, ru.services.items[s].name]),
)
const stageTemplateNames: Record<StageTemplateId, string> = {
  site: 'Сайт',
  bot: 'Бот',
  automation: 'Автоматизация',
  app: 'Приложение и Mini App',
  small: 'Малый проект',
}
const extraNames: Record<string, string> = {
  support: 'Поддержка',
  seo: 'SEO',
  design: 'Дизайн',
  rescue: 'Спасение проекта',
}
const planNames: Record<string, string> = {
  dono: 'Dono, личный агент-учёба',
  polly: 'Polly, учитель языка',
  content: 'Контент на автопилоте',
}
const stageTitleRu: Record<string, string> = {}

type Leaf = [string, number]
function walk(node: unknown, prefix: string, out: Leaf[]) {
  if (typeof node === 'number') return void out.push([prefix, node])
  if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k, out)
}

export function leaves(p: Pricing): Leaf[] {
  const out: Leaf[] = []
  walk(p, '', out)
  return out
}

function field(path: string, def: number): PriceField {
  const [root = '', a = '', b = '', c = ''] = path.split('.')
  const usd = { unit: 'usd' as const, min: 0, max: 100000, step: 10 }
  switch (root) {
    case 'startingPrice':
      return { path, def, group: 'start', section: 'Сервисы', label: serviceNames[a] ?? a, ...usd }
    case 'catalog': {
      const cat = ru.estimator.catalog[a as keyof typeof ru.estimator.catalog]
      if (b === 'variants') {
        const v = (cat.variants as Record<string, { name: string }>)[c]
        return { path, def, group: 'kinds', section: serviceNames[a] ?? a, label: v?.name ?? c, ...usd }
      }
      const name = (cat.addons as Record<string, string>)[c] ?? c
      return { path, def, group: 'options', section: serviceNames[a] ?? a, label: name, ...usd, step: 5 }
    }
    case 'extras':
      return {
        path, def, group: 'extras', section: 'Допы',
        label: a === 'support' ? 'Поддержка, в месяц' : (extraNames[a] ?? a),
        ...usd, unit: a === 'support' ? 'usd_month' : 'usd', step: 5,
      }
    case 'agentPlans':
    case 'contentPlans':
      return {
        path, def, group: 'plans', section: planNames[a] ?? a,
        label: b === 'setup' ? 'Подключение' : 'В месяц',
        ...usd, unit: b === 'setup' ? 'usd' : 'usd_month', step: 5,
      }
    case 'bundleDiscount':
      return { path, def, group: 'discounts', section: 'Скидки', label: 'Скидка на сборку из двух и более частей', unit: 'percent', min: 0, max: 50, step: 1 }
    case 'referralPercent':
      return { path, def, group: 'discounts', section: 'Реферал', label: 'Награда за приведённого клиента', unit: 'percent', min: 0, max: 50, step: 1 }
    case 'smallProjectMaxUsd':
      return { path, def, group: 'stages', section: 'Порог', label: 'Малый проект: сумма проекта ниже', unit: 'usd', min: 0, max: 5000, step: 10 }
    case 'stageShares':
      return {
        path, def, group: 'stages', section: stageTemplateNames[a as StageTemplateId] ?? a,
        label: stageTitleRu[`${a}.${b}`] ?? b, unit: 'percent', min: 0, max: 100, step: 5,
      }
  }
  throw new Error(`unknown price path ${path}`)
}

for (const id of stageTemplateIds)
  for (const s of stageDefs(id, defaultPricing)) stageTitleRu[`${id}.${s.id}`] = s.title.ru

// Every editable price, in display order.
export const priceFields: PriceField[] = leaves(defaultPricing).map(([p, v]) => field(p, v))
const fieldByPath = new Map(priceFields.map((f) => [f.path, f]))
export const fieldOf = (path: string) => fieldByPath.get(path)

// A value valid for the field: a finite integer inside its limits.
export function valueError(path: string, value: unknown): string | null {
  const f = fieldByPath.get(path)
  if (!f) return 'unknown_path'
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not_a_number'
  if (!Number.isInteger(value)) return 'not_integer'
  if (value < f.min || value > f.max) return 'out_of_range'
  return null
}

export function getAt(obj: unknown, path: string): unknown {
  let node = obj
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined
    node = (node as Record<string, unknown>)[key]
  }
  return node
}

function setAt(obj: Overrides, path: string, value: number) {
  const keys = path.split('.')
  let node = obj
  for (const key of keys.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {}
    node = node[key] as Overrides
  }
  node[keys[keys.length - 1] as string] = value
}

function unsetAt(obj: Overrides, path: string) {
  const keys = path.split('.')
  const trail: Overrides[] = [obj]
  let node = obj
  for (const key of keys.slice(0, -1)) {
    const next = node[key]
    if (!next || typeof next !== 'object') return
    node = next as Overrides
    trail.push(node)
  }
  delete node[keys[keys.length - 1] as string]
  for (let i = trail.length - 1; i > 0; i--) {
    const child = trail[i] as Overrides
    if (Object.keys(child).length === 0) delete (trail[i - 1] as Overrides)[keys[i - 1] as string]
  }
}

const clone = <T>(v: T): T => structuredClone(v)

// The sum of a template's shares, from a pricing.
export const shareSum = (p: Pricing, id: StageTemplateId) =>
  stageIds[id].reduce((sum, s) => sum + (p.stageShares[id][s] ?? 0), 0)

// Templates whose shares do not sum to 100.
export const badTemplates = (p: Pricing) => stageTemplateIds.filter((id) => shareSum(p, id) !== 100)

function buildSchema(node: unknown, path: string): z.ZodType {
  if (typeof node === 'number') {
    const f = fieldByPath.get(path)!
    return z.number().int().min(f.min).max(f.max)
  }
  const shape: Record<string, z.ZodType> = {}
  for (const [k, v] of Object.entries(node as object)) shape[k] = buildSchema(v, path ? `${path}.${k}` : k)
  return z.object(shape).strict()
}

const pricingSchema = buildSchema(defaultPricing, '').superRefine((value, ctx) => {
  for (const id of badTemplates(value as Pricing))
    ctx.addIssue({ code: 'custom', message: `stage_sum:${id}`, path: ['stageShares', id] })
})

// Zod check of a whole pricing; the readable key of the first problem, or null.
export function pricingError(p: unknown): string | null {
  const r = pricingSchema.safeParse(p)
  if (r.success) return null
  const issue = r.error.issues[0]
  if (!issue) return 'invalid'
  return issue.message.startsWith('stage_sum:') ? issue.message : `invalid:${issue.path.join('.')}`
}

// The defaults with the overrides laid over them. Anything unknown or invalid in the overrides is
// ignored (and reported through `warn`); a template whose shares would not sum to 100 keeps its
// default shares. The result always passes `pricingError`.
export function resolvePricing(overrides: unknown, warn: (message: string) => void = () => {}): Pricing {
  const merged = clone(defaultPricing)
  const flat: Leaf[] = []
  walk(overrides, '', flat)
  for (const [path, value] of flat) {
    const err = valueError(path, value)
    if (err) {
      warn(`price override ignored: ${path} (${err})`)
      continue
    }
    setAt(merged as unknown as Overrides, path, value)
  }
  for (const id of badTemplates(merged)) {
    warn(`price override ignored: stageShares.${id} (stage_sum)`)
    merged.stageShares[id] = { ...defaultPricing.stageShares[id] }
  }
  return pricingError(merged) ? clone(defaultPricing) : merged
}

export type Op = { path: string; value: number } | { reset: string }
export type ApplyResult = { ok: true; state: PricesState; changed: number } | { ok: false; error: string }

// Applies edit operations atomically: either every one is valid and the result passes the whole
// check (shares of a template sum to 100), or nothing changes. A value equal to the default clears
// the override. `{ reset: path }` clears one price, `{ reset: 'all' }` all of them.
export function applyOps(state: PricesState, ops: Op[], now: Date = new Date(), by = 'owner'): ApplyResult {
  if (!ops.length) return { ok: false, error: 'no_ops' }
  const before = resolvePricing(state.overrides)
  const overrides = clone(state.overrides)
  for (const op of ops) {
    if ('reset' in op) {
      if (op.reset === 'all') for (const k of Object.keys(overrides)) delete overrides[k]
      else if (fieldByPath.has(op.reset)) unsetAt(overrides, op.reset)
      else return { ok: false, error: 'unknown_path' }
      continue
    }
    const err = valueError(op.path, op.value)
    if (err) return { ok: false, error: `${err}:${op.path}` }
    if (op.value === getAt(defaultPricing, op.path)) unsetAt(overrides, op.path)
    else setAt(overrides, op.path, op.value)
  }
  const after = resolvePricing(overrides)
  // resolvePricing silently reverts a broken template; an edit must fail loudly instead.
  const wanted = clone(defaultPricing)
  const flat: Leaf[] = []
  walk(overrides, '', flat)
  for (const [path, value] of flat) setAt(wanted as unknown as Overrides, path, value)
  const problem = pricingError(wanted)
  if (problem) return { ok: false, error: problem }
  const at = now.toISOString()
  const history: HistoryEntry[] = []
  for (const [path, to] of leaves(after)) {
    const from = getAt(before, path) as number
    if (from !== to) history.push({ at, path, from, to, by })
  }
  if (!history.length) return { ok: true, state, changed: 0 }
  return {
    ok: true,
    changed: history.length,
    state: {
      overrides,
      updatedAt: at,
      history: [...state.history, ...history].slice(-HISTORY_MAX),
    },
  }
}

// What the Пульт needs next to the numbers.
export function editorView(state: PricesState) {
  const merged = resolvePricing(state.overrides)
  const overridden = leaves(merged)
    .filter(([p, v]) => v !== getAt(defaultPricing, p))
    .map(([p]) => p)
  return {
    defaults: defaultPricing,
    overrides: state.overrides,
    merged,
    overridden,
    updatedAt: state.updatedAt,
    history: [...state.history].reverse().slice(0, 50),
    fields: priceFields,
    groups: groupTitles,
    stages: Object.fromEntries(
      stageTemplateIds.map((id) => [id, { name: stageTemplateNames[id], ids: stageIds[id] }]),
    ),
    plans: { agent: agentPlanList(merged), content: contentPlanList(merged) },
  }
}

// Sanitizes a stored file: unknown shape becomes empty, bad history rows are dropped.
export function sanitizePrices(raw: unknown): PricesState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PricesState>
  const history = Array.isArray(r.history)
    ? r.history.filter(
        (h): h is HistoryEntry =>
          !!h && typeof h.at === 'string' && typeof h.path === 'string' && typeof h.from === 'number' && typeof h.to === 'number',
      ).map((h) => ({ ...h, by: typeof h.by === 'string' ? h.by : 'owner' }))
    : []
  return {
    overrides: r.overrides && typeof r.overrides === 'object' ? (r.overrides as Overrides) : {},
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    history: history.slice(-HISTORY_MAX),
  }
}
