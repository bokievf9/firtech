// One price grid (owner audit 2026-11-24): one formatter, one source of the niche «от» price, the estimate's top block.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
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

const F = await import('../src/lib/price-format.ts')
const P = await import('../src/lib/builder-presets.ts')
const { presetIds } = await import('../src/content/builder-presets.ts')
const { kindIds } = await import('../src/content/builder-catalog.ts')
const { defaultPricing } = await import('../src/lib/pricing.ts')
const { estimateDoc } = await import('../src/lib/estimate-doc.ts')
const { emptyBuild } = await import('../src/lib/builder.ts')
const { toggleAgent } = await import('../src/lib/builder-agent.ts')
const { getDict } = await import('../src/content/index.ts')
const ru = getDict('ru')
const en = getDict('en')
const read = (f) => readFileSync(f, 'utf8')
const nb = (s) => s.replace(/ /g, ' ')

test('priceLine and fromLine: setup first, monthly always with its setup, RU and EN', () => {
  assert.equal(nb(F.priceLine(220, 39, 'ru')), '220 USD разово + 39 USD/мес')
  assert.equal(nb(F.priceLine(220, 39, 'en')), '220 USD setup + 39 USD/mo')
  assert.equal(nb(F.fromLine(220, 39, 'ru')), 'от 220 USD разово + 39 USD/мес')
  assert.equal(nb(F.fromLine(300, 0, 'en')), 'from 300 USD setup')
  assert.equal(nb(F.priceLine(1200, 0, 'ru')), '1 200 USD разово')
})

test('niche «от» price: one source for the solutions pages and the presets row', () => {
  for (const id of presetIds) {
    const kind = { auto: 'carservice', school: 'onlineschool' }[id] ?? id
    assert.deepEqual(P.nichePrice(kind, defaultPricing), P.presetPrice(id, defaultPricing), id)
  }
  for (const kind of kindIds) {
    if (kind === 'other') continue
    const price = P.nichePrice(kind, defaultPricing)
    assert.ok(price.oneTime > 0, kind)
  }
  for (const file of ['src/components/solutions-home.tsx', 'src/app/[locale]/solutions/page.tsx', 'src/app/[locale]/solutions/[kind]/page.tsx']) {
    const text = read(file)
    assert.match(text, /nichePrice\(/, file)
    assert.doesNotMatch(text, /formatUsd\(quote\(presets\[/, file)
  }
  assert.match(read('src/components/builder-presets.tsx'), /presetPrice\(id, pricing\)/)
})

test('public price surfaces go through the shared formatter, none shows a bare monthly «от»', () => {
  for (const file of ['src/components/home-agents.tsx', 'src/components/products/product-price.tsx', 'src/components/solutions-home.tsx', 'src/components/builder-presets.tsx']) {
    assert.match(read(file), /fromLine|priceLine/, file)
  }
  const team = read('src/app/[locale]/ai-team/page.tsx')
  assert.match(team, /colSetup/)
  assert.match(team, /colMonthly/)
  assert.doesNotMatch(read('src/components/home-agents.tsx'), /formatUsd\(monthly\)/)
})

test('estimate: pay now, subscription apart, start, no «назовём в смете» about the term', () => {
  const build = toggleAgent(emptyBuild, 'lead-handler')
  for (const [dict, loc] of [[ru, 'ru'], [en, 'en']]) {
    const doc = estimateDoc(build, dict, loc, defaultPricing)
    assert.ok(doc.payNow, loc)
    assert.match(doc.payNow.stage, /1/)
    assert.ok(doc.subscription, loc)
    assert.ok(doc.start.length > 10)
    assert.doesNotMatch(JSON.stringify(dict.builder), /Точный общий срок|exact overall timeline/)
  }
  const doc = estimateDoc(build, ru, 'ru', defaultPricing)
  assert.equal(doc.payNow.label, 'Платите сейчас')
  assert.match(doc.subscription.text, /в первый платёж не входит/)
  const none = estimateDoc(emptyBuild, ru, 'ru', defaultPricing)
  assert.equal(none.payNow, null)
  assert.equal(none.subscription, null)
})
