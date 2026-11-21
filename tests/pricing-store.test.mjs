// Editable prices (owner 2026-11-21): the pure editor logic, the JSON store, the admin route, the
// live /api/prices and the rule that client code never computes with the default constants.
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/cache')
      return { url: 'data:text/javascript,export const revalidatePath=(...a)=>{globalThis.__revalidated=(globalThis.__revalidated??[]).concat([a])}', shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const root = await mkdtemp(path.join(tmpdir(), 'firtech-prices-test-'))
let dirCount = 0
after(() => rm(root, { recursive: true, force: true }))
beforeEach(() => {
  process.env.DATA_DIR = path.join(root, `d${++dirCount}`)
  globalThis.__revalidated = []
})

const pricing = await import('../src/lib/pricing.ts')
const edit = await import('../src/lib/pricing-edit.ts')
const store = await import('../src/lib/pricing-store.ts')
const { quote, decodeBuild } = await import('../src/lib/builder.ts')
const { stagesFor, stageTemplateId } = await import('../src/lib/payment-stages.ts')
const { productPrices } = await import('../src/lib/products.ts')
const { pricesJson } = await import('../src/lib/prices-json.ts')
const auth = await import('../src/lib/admin-auth.ts')
const route = await import('../src/app/api/admin/prices/route.ts')
const publicRoute = await import('../src/app/api/prices/route.ts')

const { defaultPricing } = pricing
const NOW = new Date('2026-11-21T10:00:00Z')
const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r
}

test('defaults: no overrides give the default pricing, deep equal and valid', () => {
  const merged = edit.resolvePricing({})
  assert.deepEqual(merged, defaultPricing)
  assert.equal(edit.pricingError(merged), null)
  assert.notEqual(merged, defaultPricing, 'a copy, so nobody mutates the defaults')
  // The constants other code still imports are the defaults.
  assert.equal(pricing.startingPrice.websites, 150)
  assert.equal(pricing.bundleDiscount, 0.1)
  assert.deepEqual(pricing.agentPlans.map((p) => p.id), ['dono', 'polly'])
})

test('merge: a deep partial overrides only what it names', () => {
  const merged = edit.resolvePricing({
    startingPrice: { websites: 180 },
    catalog: { bots: { addons: { ai: 150 } } },
    agentPlans: { dono: { monthly: 20 } },
  })
  assert.equal(merged.startingPrice.websites, 180)
  assert.equal(merged.startingPrice.bots, defaultPricing.startingPrice.bots)
  assert.equal(merged.catalog.bots.addons.ai, 150)
  assert.equal(merged.catalog.bots.addons.admin, defaultPricing.catalog.bots.addons.admin)
  assert.deepEqual(merged.agentPlans.dono, { setup: 150, monthly: 20 })
  assert.deepEqual(merged.agentPlans.polly, defaultPricing.agentPlans.polly)
})

test('validation: invalid, unknown and out-of-range overrides are ignored with a warning', () => {
  const warnings = []
  const merged = edit.resolvePricing(
    {
      startingPrice: { websites: -5, bots: 12.5, apps: 'a lot', automation: 250 },
      referralPercent: 51,
      bundleDiscount: 51,
      smallProjectMaxUsd: 5001,
      nonsense: { x: 1 },
      catalog: { websites: { variants: { landing: 99, unknown: 5 } } },
    },
    (m) => warnings.push(m),
  )
  assert.equal(merged.startingPrice.websites, 150)
  assert.equal(merged.startingPrice.bots, 100)
  assert.equal(merged.startingPrice.apps, 800)
  assert.equal(merged.startingPrice.automation, 250, 'the valid sibling still applies')
  assert.equal(merged.referralPercent, 10)
  assert.equal(merged.bundleDiscount, 10)
  assert.equal(merged.smallProjectMaxUsd, 300)
  assert.equal(merged.catalog.websites.variants.landing, 99)
  assert.equal('unknown' in merged.catalog.websites.variants, false)
  assert.equal(edit.pricingError(merged), null)
  assert.ok(warnings.length >= 7, warnings.join('|'))
  // Garbage as a whole is just the defaults.
  assert.deepEqual(edit.resolvePricing(null), defaultPricing)
  assert.deepEqual(edit.resolvePricing('x'), defaultPricing)
})

test('validation: limits of the three percent/threshold fields', () => {
  assert.equal(edit.valueError('smallProjectMaxUsd', 5000), null)
  assert.equal(edit.valueError('smallProjectMaxUsd', 5001), 'out_of_range')
  assert.equal(edit.valueError('referralPercent', 50), null)
  assert.equal(edit.valueError('referralPercent', 51), 'out_of_range')
  assert.equal(edit.valueError('bundleDiscount', 0), null)
  assert.equal(edit.valueError('bundleDiscount', -1), 'out_of_range')
  assert.equal(edit.valueError('startingPrice.websites', 0), null)
  assert.equal(edit.valueError('startingPrice.websites', 1.5), 'not_integer')
  assert.equal(edit.valueError('startingPrice.websites', NaN), 'not_a_number')
  assert.equal(edit.valueError('startingPrice.nope', 5), 'unknown_path')
})

test('stage shares: a template that does not sum to 100 is refused, a batch that does is saved', () => {
  const state = edit.emptyPrices()
  const single = edit.applyOps(state, [{ path: 'stageShares.site.structure', value: 35 }], NOW)
  assert.deepEqual(single, { ok: false, error: 'stage_sum:site' })
  const batch = ok(
    edit.applyOps(
      state,
      [
        { path: 'stageShares.site.structure', value: 35 },
        { path: 'stageShares.site.pages', value: 35 },
      ],
      NOW,
    ),
  )
  assert.equal(batch.changed, 2)
  assert.deepEqual(edit.resolvePricing(batch.state.overrides).stageShares.site, { structure: 35, pages: 35, launch: 30 })
  // A stored file with broken shares keeps the defaults for that template (and still loads).
  const warnings = []
  const merged = edit.resolvePricing({ stageShares: { app: { design: 90 }, bot: { build: 30, launch: 40 } } }, (m) => warnings.push(m))
  assert.deepEqual(merged.stageShares.app, defaultPricing.stageShares.app)
  assert.deepEqual(merged.stageShares.bot, { scenario: 30, build: 30, launch: 40 })
  assert.equal(edit.pricingError(merged), null)
  assert.ok(warnings.some((w) => w.includes('stageShares.app')))
})

test('ops: history records path, from, to; equal-to-default clears the override; no-op changes nothing', () => {
  let state = ok(edit.applyOps(edit.emptyPrices(), [{ path: 'startingPrice.websites', value: 200 }], NOW)).state
  assert.deepEqual(state.overrides, { startingPrice: { websites: 200 } })
  assert.equal(state.updatedAt, NOW.toISOString())
  assert.deepEqual(state.history, [{ at: NOW.toISOString(), path: 'startingPrice.websites', from: 150, to: 200, by: 'owner' }])
  const same = ok(edit.applyOps(state, [{ path: 'startingPrice.websites', value: 200 }], NOW))
  assert.equal(same.changed, 0)
  assert.equal(same.state, state)
  state = ok(edit.applyOps(state, [{ path: 'startingPrice.websites', value: 150 }], NOW)).state
  assert.deepEqual(state.overrides, {}, 'back to the default leaves no override, not even an empty object')
  assert.equal(state.history.length, 2)
  assert.equal(state.history[1].from, 200)
  assert.equal(state.history[1].to, 150)
})

test('ops: errors have readable keys and change nothing', () => {
  const state = edit.emptyPrices()
  assert.deepEqual(edit.applyOps(state, [{ path: 'startingPrice.nope', value: 1 }], NOW), { ok: false, error: 'unknown_path:startingPrice.nope' })
  assert.deepEqual(edit.applyOps(state, [{ path: 'startingPrice.apps', value: -1 }], NOW), { ok: false, error: 'out_of_range:startingPrice.apps' })
  assert.deepEqual(edit.applyOps(state, [{ reset: 'nope' }], NOW), { ok: false, error: 'unknown_path' })
  assert.deepEqual(edit.applyOps(state, [], NOW), { ok: false, error: 'no_ops' })
  // One bad op in a batch refuses the whole batch.
  const batch = edit.applyOps(state, [{ path: 'startingPrice.apps', value: 900 }, { path: 'referralPercent', value: 99 }], NOW)
  assert.equal(batch.ok, false)
})

test('reset: one path, or everything; the history keeps both', () => {
  const edited = ok(
    edit.applyOps(
      edit.emptyPrices(),
      [{ path: 'startingPrice.bots', value: 120 }, { path: 'referralPercent', value: 12 }, { path: 'catalog.apps.addons.push', value: 70 }],
      NOW,
    ),
  ).state
  const one = ok(edit.applyOps(edited, [{ reset: 'referralPercent' }], NOW)).state
  assert.deepEqual(one.overrides, { startingPrice: { bots: 120 }, catalog: { apps: { addons: { push: 70 } } } })
  const all = ok(edit.applyOps(one, [{ reset: 'all' }], NOW)).state
  assert.deepEqual(all.overrides, {})
  assert.deepEqual(edit.resolvePricing(all.overrides), defaultPricing)
  assert.equal(all.history.length, 3 + 1 + 2)
})

test('history is capped at the last 200 entries', () => {
  let state = edit.emptyPrices()
  for (let i = 0; i < 230; i++)
    state = ok(edit.applyOps(state, [{ path: 'startingPrice.websites', value: 100 + (i % 2) * 7 + (i > 0 ? 1 : 0) }], NOW)).state
  assert.ok(state.history.length <= 200)
  assert.equal(state.history.length, 200)
  assert.equal(edit.sanitizePrices({ history: state.history.concat([{ junk: 1 }]) }).history.length, 200)
})

test('editor view: every field has a label, group, unit and limits; paths cover the whole pricing', () => {
  const paths = edit.leaves(defaultPricing).map(([p]) => p)
  assert.deepEqual(edit.priceFields.map((f) => f.path), paths)
  for (const f of edit.priceFields) {
    assert.ok(f.label && f.group && f.section, f.path)
    assert.ok(['usd', 'usd_month', 'percent'].includes(f.unit), f.path)
    assert.ok(f.min <= f.def && f.def <= f.max && f.step > 0, f.path)
    assert.equal(/\{|undefined/.test(f.label), false, f.label)
  }
  assert.deepEqual(new Set(edit.priceFields.map((f) => f.group)), new Set(Object.keys(edit.groupTitles)))
  const view = edit.editorView(ok(edit.applyOps(edit.emptyPrices(), [{ path: 'startingPrice.apps', value: 900 }], NOW)).state)
  assert.deepEqual(view.overridden, ['startingPrice.apps'])
  assert.equal(view.merged.startingPrice.apps, 900)
  assert.equal(view.defaults.startingPrice.apps, 800)
  assert.equal(view.history.length, 1)
})

test('calculators follow the pricing argument; defaults reproduce the old numbers', () => {
  const build = decodeBuild('websites.landing.telegram~bots.faq')
  assert.equal(quote(build).total, quote(build, defaultPricing).total)
  assert.equal(quote(build).subtotal, 150 + 20 + 100)
  const custom = structuredClone(defaultPricing)
  custom.catalog.websites.variants.landing = 1000
  custom.bundleDiscount = 0
  assert.equal(quote(build, custom).total, 1000 + 20 + 100)
  // Stages: the small-project limit and the shares come from the pricing too.
  assert.equal(stageTemplateId(build.parts, 400), 'site')
  assert.equal(stageTemplateId(build.parts, 400, { ...custom, smallProjectMaxUsd: 500 }), 'small')
  custom.stageShares.site = { structure: 20, pages: 50, launch: 30 }
  assert.deepEqual(stagesFor('site', 1000, custom).map((s) => s.amountUsd), [200, 500, 300])
  assert.deepEqual(stagesFor('site', 1000).map((s) => s.amountUsd), [300, 400, 300])
  // Product cards and the public JSON.
  assert.equal(productPrices(custom).admin.kind, 'from')
  const json = pricesJson(custom, '2026-12-01')
  assert.equal(json.updatedAt, '2026-12-01')
  assert.equal(json.catalog.websites.variants.landing, 1000)
  assert.equal(json.bundleDiscountPercent, 0)
  assert.deepEqual(json.stages.site.map((s) => s.share), [20, 50, 30])
})

test('store: edits persist to prices.json, getPricing merges them, the file is private and atomic', async () => {
  assert.deepEqual(await store.getPricing(), defaultPricing)
  assert.equal(await store.getPricesUpdatedAt(), '2026-11-21')
  const result = await store.updatePrices([{ path: 'startingPrice.websites', value: 175 }], NOW)
  assert.equal(result.ok, true)
  const live = await store.getPricing()
  assert.equal(live.startingPrice.websites, 175)
  assert.equal((await store.getPricesState()).updatedAt, NOW.toISOString())
  assert.equal(await store.getPricesUpdatedAt(), NOW.toISOString())
  const file = JSON.parse(await readFile(path.join(process.env.DATA_DIR, 'prices.json'), 'utf8'))
  assert.deepEqual(file.overrides, { startingPrice: { websites: 175 } })
  assert.deepEqual(await readdir(process.env.DATA_DIR), ['prices.json'], 'no temp file left behind')
  // Refused edits do not touch the file.
  const bad = await store.updatePrices([{ path: 'referralPercent', value: 80 }], NOW)
  assert.equal(bad.ok, false)
  assert.deepEqual(JSON.parse(await readFile(path.join(process.env.DATA_DIR, 'prices.json'), 'utf8')), file)
  // Concurrent edits are queued, none is lost.
  await Promise.all([
    store.updatePrices([{ path: 'startingPrice.bots', value: 111 }], NOW),
    store.updatePrices([{ path: 'startingPrice.apps', value: 888 }], NOW),
  ])
  const after2 = await store.getPricing()
  assert.deepEqual([after2.startingPrice.bots, after2.startingPrice.apps, after2.startingPrice.websites], [111, 888, 175])
})

test('store: a broken or hand-edited file never breaks the site', async () => {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(process.env.DATA_DIR, { recursive: true })
  const file = path.join(process.env.DATA_DIR, 'prices.json')
  await writeFile(file, '{ not json')
  const warn = console.warn
  const seen = []
  console.warn = (m) => seen.push(String(m))
  try {
    assert.deepEqual(await store.getPricing(), defaultPricing)
    await writeFile(file, JSON.stringify({ overrides: { startingPrice: { websites: -1, bots: 130 }, referralPercent: 'x' }, updatedAt: 5, history: 'no' }))
    const live = await store.getPricing()
    assert.equal(live.startingPrice.websites, 150)
    assert.equal(live.startingPrice.bots, 130)
    assert.equal(live.referralPercent, 10)
  } finally {
    console.warn = warn
  }
  assert.ok(seen.some((m) => m.includes('startingPrice.websites')), seen.join('|'))
  // Writing over an unreadable file is refused rather than silently replacing it.
  await writeFile(file, '{ not json')
  await assert.rejects(store.updatePrices([{ path: 'startingPrice.websites', value: 160 }], NOW))
  assert.equal(await readFile(file, 'utf8'), '{ not json')
})

// --- admin route ---
const ORIGIN = 'http://localhost'
async function session() {
  const issued = await auth.issueCode(Date.now(), { browser: 'b1' })
  const verified = await auth.verifyCode(issued.code, Date.now(), 'b1')
  return verified.token
}
function req(method, body, { cookie, origin = ORIGIN, type = 'application/json' } = {}) {
  const headers = { host: 'localhost', 'content-type': type }
  if (origin) headers.origin = origin
  if (cookie) headers.cookie = `${auth.SESSION_COOKIE}=${cookie}`
  return new Request(`${ORIGIN}/api/admin/prices`, {
    method,
    headers,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  })
}

test('admin route: session and Origin are required, JSON only, bad bodies are 400', async () => {
  const cookie = await session()
  assert.equal((await route.GET(req('GET'))).status, 401)
  assert.equal((await route.POST(req('POST', { path: 'referralPercent', value: 12 }))).status, 401)
  assert.equal((await route.POST(req('POST', { path: 'referralPercent', value: 12 }, { cookie, origin: 'http://evil.example' }))).status, 403)
  assert.equal((await route.POST(req('POST', 'path=x', { cookie, type: 'text/plain' }))).status, 415)
  assert.equal((await route.POST(req('POST', '{oops', { cookie }))).status, 400)
  assert.equal((await route.POST(req('POST', { path: 'referralPercent', value: 'x' }, { cookie }))).status, 400)
  assert.equal((await route.POST(req('POST', { path: 'referralPercent', value: 12, extra: 1 }, { cookie }))).status, 400)
  assert.deepEqual(globalThis.__revalidated, [])
})

test('admin route: GET view, single edit, batch, refusal with a key, reset; revalidates the layout', async () => {
  const cookie = await session()
  let res = await route.GET(req('GET', undefined, { cookie }))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  let body = await res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.defaults, defaultPricing)
  assert.deepEqual(body.merged, defaultPricing)
  assert.equal(body.fields.length, edit.priceFields.length)
  assert.deepEqual(body.overrides, {})
  assert.deepEqual(body.history, [])
  assert.ok(body.groups.start && body.stages.site)

  res = await route.POST(req('POST', { path: 'startingPrice.websites', value: 190 }, { cookie }))
  assert.equal(res.status, 200)
  body = await res.json()
  assert.equal(body.changed, 1)
  assert.equal(body.merged.startingPrice.websites, 190)
  assert.deepEqual(body.overridden, ['startingPrice.websites'])
  assert.deepEqual(globalThis.__revalidated, [['/', 'layout']])

  res = await route.POST(req('POST', { ops: [{ path: 'stageShares.small.start', value: 60 }, { path: 'stageShares.small.launch', value: 40 }] }, { cookie }))
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).merged.stageShares.small, { start: 60, launch: 40 })

  res = await route.POST(req('POST', { path: 'stageShares.small.start', value: 70 }, { cookie }))
  assert.equal(res.status, 422)
  assert.deepEqual(await res.json(), { ok: false, error: 'stage_sum:small' })
  res = await route.POST(req('POST', { path: 'referralPercent', value: 60 }, { cookie }))
  assert.deepEqual(await res.json(), { ok: false, error: 'out_of_range:referralPercent' })

  const revalidatedBefore = globalThis.__revalidated.length
  res = await route.POST(req('POST', { action: 'reset', path: 'startingPrice.websites' }, { cookie }))
  assert.equal((await res.json()).merged.startingPrice.websites, 150)
  res = await route.POST(req('POST', { action: 'reset' }, { cookie }))
  body = await res.json()
  assert.deepEqual(body.merged, defaultPricing)
  assert.deepEqual(body.overrides, {})
  assert.equal(body.history[0].path.length > 0, true)
  assert.equal(globalThis.__revalidated.length, revalidatedBefore + 2)
  // A reset when nothing is overridden is a no-op and does not revalidate.
  res = await route.POST(req('POST', { action: 'reset' }, { cookie }))
  assert.equal((await res.json()).changed, 0)
  assert.equal(globalThis.__revalidated.length, revalidatedBefore + 2)
})

test('public /api/prices: dynamic, cached for a minute, shows the owner edits and updatedAt', async () => {
  const text = readFileSync('src/app/api/prices/route.ts', 'utf8')
  assert.match(text, /force-dynamic/)
  const first = await publicRoute.GET()
  assert.equal(first.headers.get('cache-control'), 'public, max-age=60')
  const before = await first.json()
  assert.equal(before.updatedAt, '2026-11-21')
  await store.updatePrices([{ path: 'catalog.websites.variants.landing', value: 160 }, { path: 'bundleDiscount', value: 12 }], NOW)
  const after2 = await (await publicRoute.GET()).json()
  assert.equal(after2.updatedAt, NOW.toISOString())
  assert.equal(after2.catalog.websites.variants.landing, 160)
  assert.equal(after2.bundleDiscountPercent, 12)
  assert.equal(after2.products.admin.from, before.products.admin.from, 'a product without a landing page is unchanged')
})

// --- structure rules ---
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

test('no component or page computes with the default price constants; client code reads usePricing()', () => {
  const banned = ['defaultPricing', 'startingPrice', 'catalog', 'extraPrice', 'agentPlans', 'contentPlans', 'bundleDiscount', 'referralPercent', 'smallProjectMaxUsd', 'paymentStages', 'productPrice', 'lowestPrice', 'highestStartingPrice']
  const offenders = []
  for (const file of [...walk('src/components'), ...walk('src/app')].filter((f) => /\.tsx?$/.test(f))) {
    // The provider's context default is the one allowed use of the defaults on the client.
    if (file.endsWith('pricing-provider.tsx')) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(@\/lib\/(?:pricing|products|seo)|\.\.?\/[^']*(?:pricing|products|seo))'/g)) {
      for (const name of m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0])) {
        if (banned.includes(name)) offenders.push(`${file}: ${name}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
  // The client components of the builder take the live pricing from the provider.
  for (const f of ['builder', 'builder-brief', 'builder-steps', 'builder-summary', 'service-concepts', 'estimate-gate', 'estimate-sheet'])
    assert.match(readFileSync(`src/components/${f}.tsx`, 'utf8'), /usePricing\(\)/, f)
  assert.match(readFileSync('src/app/[locale]/layout.tsx', 'utf8'), /<PricingProvider pricing=\{pricing\}>/)
  assert.match(readFileSync('src/app/[locale]/layout.tsx', 'utf8'), /export const revalidate = 300/)
  // Client files never import the server-only store.
  for (const file of walk('src/components').filter((f) => /\.tsx$/.test(f)))
    if (/^'use client'/.test(readFileSync(file, 'utf8')))
      assert.doesNotMatch(readFileSync(file, 'utf8'), /pricing-store/, file)
})

test('Пульт: the «Цены» tab belongs to the Компания panel, has a label and strings, and is wired in', async () => {
  const pult = await import('../src/lib/pult.ts')
  const { admin } = await import('../src/content/admin.ts')
  assert.deepEqual(pult.PANEL_TABS.company, ['company', 'prices'])
  assert.equal(admin.hub.tabs.prices, 'Цены')
  assert.match(readFileSync('src/components/admin/hub/panels.tsx', 'utf8'), /tab === 'prices' \? <PricesTab \/>/)
  const ui = readFileSync('src/components/admin/pult/company-prices.tsx', 'utf8')
  // Inline edit: Enter saves, Escape cancels; the stage sum blocks saving.
  assert.match(ui, /e\.key === 'Enter'/)
  assert.match(ui, /e\.key === 'Escape'/)
  assert.match(ui, /disabled=\{!valid\}/)
  for (const key of ['defaultHint', 'resetAll', 'resetAllConfirm', 'history', 'stageSumBad', 'previewBot']) assert.ok(admin.pult.prices[key], key)
  for (const [code, text] of Object.entries(admin.pult.prices.errors)) assert.ok(text, code)
  assert.doesNotMatch(JSON.stringify(admin.pult.prices), /\$\d/, 'no typed prices in the tab copy')
})
