import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  builderUi,
  categoryNames,
  densityNames,
  kindCatalog,
  kindCategories,
  kindIds,
  kindName,
  kindsByCategory,
  kitNames,
  moodNames,
  paletteNames,
  productCatalog,
  productIds,
  shapeNames,
  typeNames,
} from '../src/content/builder-catalog.ts'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import {
  applyKind,
  buildGoals,
  decodeBuild,
  encodeBuild,
  presets,
  productParts,
  productsOnRequest,
  quote,
  styleDensities,
  styleKits,
  styleMoods,
  stylePalettes,
  styleShapes,
  styleTypes,
  toggleProduct,
} from '../src/lib/builder.ts'
import {
  applyKit,
  currentAxes,
  kits,
  moodTokens,
  palettes,
  resolveLook,
  setAxis,
  shapeTokens,
  styleVars,
  typeTokens,
} from '../src/lib/builder-style.ts'
import { estimateDoc, leadLimit, leadSummary } from '../src/lib/estimate-doc.ts'
import { estimate } from '../src/lib/pricing.ts'
import { allSolutionKinds, solutionCopy } from '../src/lib/solutions.ts'

const dashes = /[–—]/
const locales = [
  ['ru', ru],
  ['en', en],
]

test('catalogue: 40+ kinds in every requested category, each with complete copy', () => {
  assert.ok(kindIds.length >= 40, `${kindIds.length} kinds`)
  assert.equal(new Set(kindIds).size, kindIds.length)
  assert.equal(kindsByCategory.flatMap((g) => g.kinds).length, kindIds.length)
  for (const category of kindCategories) {
    assert.ok(categoryNames[category].ru && categoryNames[category].en, category)
    assert.ok(kindsByCategory.some((g) => g.category === category), `${category} has kinds`)
  }
  for (const id of kindIds) {
    const entry = kindCatalog[id]
    assert.ok(entry.emoji, `${id}: emoji`)
    assert.ok(kindCategories.includes(entry.category), `${id}: category`)
    assert.ok(entry.goals.every((g) => buildGoals.includes(g)), `${id}: goals`)
    assert.ok(entry.products.length <= 2, `${id}: 1-2 products`)
    assert.ok(entry.products.every((p) => productIds.includes(p)), `${id}: product ids`)
    for (const loc of ['ru', 'en']) {
      const [name, title, sub, pains, gets] = entry[loc]
      for (const text of [name, title, sub]) assert.ok(text.trim(), `${id} ${loc}`)
      assert.equal(pains.length, 3, `${id} ${loc}: 3 pains`)
      assert.equal(gets.length, 3, `${id} ${loc}: 3 gets`)
      for (const text of [...pains, ...gets]) assert.ok(text.trim().length > 8, `${id} ${loc}`)
      assert.doesNotMatch(JSON.stringify(entry[loc]), dashes, `${id} ${loc}: no long dashes`)
      // Prices come from pricing.ts, never from copy.
      assert.doesNotMatch(JSON.stringify(entry[loc]), /\$\s?\d/, `${id} ${loc}: no prices`)
    }
    assert.equal(kindName(id, 'ru'), entry.ru[0])
    assert.equal(kindName(id, 'en'), entry.en[0])
  }
  // The six original ids still exist, so old links and pages keep working.
  for (const id of ['cafe', 'salon', 'shop', 'delivery', 'services', 'other'])
    assert.ok(kindIds.includes(id), id)
})

test('catalogue: kinds are the niches the owner asked for', () => {
  for (const id of [
    'restaurant', 'coffee', 'bakery', 'catering', 'barber', 'nails', 'spa', 'cosmetology',
    'dentist', 'clinic', 'fitness', 'yoga', 'massage', 'webshop', 'flowers', 'gifts', 'clothing',
    'electronics', 'furniture', 'autoparts', 'carservice', 'carwash', 'drycleaning', 'cleaning',
    'repair', 'renovation', 'photo', 'events', 'printing', 'tutor', 'languages', 'kidscenter',
    'drivingschool', 'onlineschool', 'realty', 'lawyers', 'accounting', 'insurance', 'travel',
    'hotel', 'guesthouse', 'tours', 'logistics', 'wholesale', 'itservices', 'marketing',
    'coworking', 'pharmacy', 'vet', 'petshop',
  ])
    assert.ok(kindIds.includes(id), id)
})

test('presets: every kind has a priced, decodable starting set carrying kind and products', () => {
  for (const id of kindIds) {
    const preset = presets[id]
    assert.equal(preset.kind, id)
    assert.deepEqual(preset.products ?? [], kindCatalog[id].products)
    assert.deepEqual(decodeBuild(encodeBuild(preset)), preset, id)
    const q = quote(preset)
    assert.ok(q.lines.length > 0 && q.total > 0, `${id}: priced`)
    // Every part is a real variant with real options: nothing is dropped on decode.
    const link = decodeBuild(encodeBuild(preset))
    assert.deepEqual(link.parts, preset.parts, `${id}: parts survive`)
  }
})

test('presets: the six original kinds are exactly the old builds', () => {
  const old = {
    cafe: { websites: ['landing', ['telegram']], bots: ['booking', ['payments']] },
    salon: { bots: ['booking', ['broadcasts']], websites: ['landing', ['telegram']] },
    shop: { websites: ['shop', ['payments', 'cms']] },
    delivery: { bots: ['miniapp', ['payments', 'admin']], automation: ['integration', ['alerts']] },
    services: { websites: ['company', ['telegram']], automation: ['crm', ['training']] },
    other: { websites: ['landing', []] },
  }
  const extras = {
    cafe: ['seo'],
    salon: ['seo'],
    shop: ['seo', 'support'],
    delivery: ['support'],
    services: [],
    other: [],
  }
  for (const [id, parts] of Object.entries(old)) {
    const expected = Object.fromEntries(
      Object.entries(parts).map(([slug, [variant, addons]]) => [slug, { variant, addons }]),
    )
    assert.deepEqual(presets[id].parts, expected, id)
    assert.deepEqual(presets[id].extras, extras[id], id)
  }
})

test('solutions: every kind except other has a complete page in both languages', () => {
  assert.equal(allSolutionKinds.length, kindIds.length - 1)
  for (const [locale, dict] of locales)
    for (const kind of allSolutionKinds) {
      const page = solutionCopy(kind, locale, dict)
      for (const key of ['metaTitle', 'metaDescription', 'title', 'sub', 'card'])
        assert.ok(page[key].trim(), `${locale} ${kind}: ${key}`)
      assert.ok(page.problems.length >= 3, `${locale} ${kind}: problems`)
      for (const item of page.problems) assert.ok(item.pain && item.fix, `${locale} ${kind}`)
      assert.ok(page.faq.length >= 4 && page.faq.length <= 5, `${locale} ${kind}: faq`)
      assert.doesNotMatch(JSON.stringify(page), dashes, `${locale} ${kind}`)
    }
})

test('products: the product line, prices only from pricing.ts', () => {
  assert.deepEqual(
    [...productIds].sort(),
    ['personal', 'company', 'adminbot', 'aiteam', 'app', 'automation', 'bot', 'content', 'intake', 'miniapp', 'site'].sort(),
  )
  for (const id of productIds) {
    const p = productCatalog[id]
    assert.ok(!id.includes('-') && !id.includes('.'), `${id}: link-safe id`)
    for (const loc of ['ru', 'en']) {
      assert.ok(p.name[loc].trim() && p.hint[loc].trim(), `${id} ${loc}`)
      assert.doesNotMatch(JSON.stringify([p.name, p.hint]), dashes)
      assert.doesNotMatch(JSON.stringify([p.name, p.hint]), /\$\s?\d/)
    }
    const parts = productParts(id)
    if (p.priced) {
      assert.ok(Object.keys(parts).length > 0, `${id}: parts`)
      assert.ok(quote({ parts, extras: [] }).total > 0, `${id}: priced`)
    } else assert.deepEqual(parts, {}, `${id}: unpriced selects nothing`)
  }
  assert.deepEqual(
    productIds.filter((id) => !productCatalog[id].priced).sort(),
    ['company', 'content', 'personal'],
  )
  // The flagships lead the catalogue (owner 2026-11-22); the old `agent` id decodes as `personal`.
  assert.deepEqual(productIds.slice(0, 2), ['personal', 'company'])
})

test('products: products without a price are listed apart and never summed', () => {
  const base = presets.barber
  const withUnpriced = { ...base, products: [...base.products, 'content', 'personal'] }
  assert.deepEqual(quote(withUnpriced), quote(base))
  assert.deepEqual(productsOnRequest(withUnpriced), ['content', 'personal'])
  const only = { parts: {}, extras: [], products: ['content', 'personal'] }
  const q = quote(only)
  assert.deepEqual(q.lines, [])
  assert.equal(q.total, 0)
  for (const [locale, dict] of locales) {
    const doc = estimateDoc(only, dict, locale)
    assert.equal(doc.onRequest.length, 2)
    assert.equal(doc.onRequest[0].price, builderUi.onRequest[locale])
    // The Personal AI row carries its level plan (setup + monthly), still never summed into the total.
    assert.match(doc.onRequest[1].price, /\$290 \+ \$29/)
    assert.equal(doc.total, builderUi.onRequest[locale], 'no number for an unpriced build')
    const text = leadSummary(withUnpriced, dict, locale)
    const onRequestLine = text.split('\n').find((l) => l.startsWith(builderUi.onRequestLabel[locale]))
    assert.ok(onRequestLine, `${locale}: separate line`)
    assert.match(onRequestLine, new RegExp(productCatalog.content.name[locale]))
    assert.match(onRequestLine, new RegExp(productCatalog.personal.name[locale]))
    const totalLine = text.split('\n').find((l) => l.startsWith(dict.builder.total))
    assert.doesNotMatch(totalLine ?? '', /290/)
  }
})

test('products: toggling adds and removes the parts a product brings', () => {
  let b = { parts: {}, extras: [] }
  b = toggleProduct(b, 'adminbot')
  assert.deepEqual(b.parts.bots, { variant: 'booking', addons: ['broadcasts'] })
  assert.deepEqual(b.products, ['adminbot'])
  b = toggleProduct(b, 'site')
  assert.deepEqual(Object.keys(b.parts).sort(), ['bots', 'websites'])
  b = toggleProduct(b, 'adminbot')
  assert.deepEqual(Object.keys(b.parts), ['websites'])
  assert.deepEqual(b.products, ['site'])
  // A part the visitor changed stays when the product is dropped.
  let c = toggleProduct({ parts: {}, extras: [] }, 'miniapp')
  c = { ...c, parts: { bots: { variant: 'miniapp', addons: ['payments', 'ai'] } } }
  assert.ok(toggleProduct(c, 'miniapp').parts.bots)
  assert.equal(toggleProduct(c, 'miniapp').products, undefined)
  // Two products share one part: it stays until both are gone.
  let d = toggleProduct(toggleProduct({ parts: {}, extras: [] }, 'bot'), 'intake')
  assert.deepEqual(d.parts.bots.addons, ['ai'])
  d = toggleProduct(d, 'bot')
  assert.ok(d.parts.bots)
})

test('applyKind: replaces kind, products and parts, keeps the brief, fills goals once', () => {
  const brief = { goals: ['brand'], channels: ['instagram'], style: { kit: 'luxe' } }
  const a = applyKind({ parts: { apps: { variant: 'pwa', addons: [] } }, extras: [], ...brief }, 'barber')
  assert.equal(a.kind, 'barber')
  assert.deepEqual(a.products, kindCatalog.barber.products)
  assert.equal(a.parts.apps, undefined)
  assert.deepEqual(a.goals, ['brand'])
  assert.deepEqual(a.channels, ['instagram'])
  assert.deepEqual(a.style, { kit: 'luxe' })
  const b = applyKind({ parts: {}, extras: [], products: ['agent'] }, 'other')
  assert.equal(b.products, undefined)
  assert.deepEqual(applyKind({ parts: {}, extras: [] }, 'barber').goals, kindCatalog.barber.goals)
})

test('link: the kind and product chunks round trip, old links decode as before', () => {
  const full = {
    kind: 'dentist',
    products: ['adminbot', 'intake', 'content'],
    parts: { bots: { variant: 'booking', addons: ['broadcasts'] } },
    extras: ['seo'],
    style: { palette: 'noir', type: 'serif', shape: 'sharp', density: 'airy', mood: 'premium', kit: 'luxe' },
  }
  assert.deepEqual(decodeBuild(encodeBuild(full)), full)
  assert.match(encodeBuild(full), /~k\.dentist~p\.adminbot-intake-content/)
  assert.deepEqual(decodeBuild('websites.landing.telegram~bots.booking.payments~x.seo'), {
    parts: {
      websites: { variant: 'landing', addons: ['telegram'] },
      bots: { variant: 'booking', addons: ['payments'] },
    },
    extras: ['seo'],
  })
  // An old link with the old style chunk keeps its four fields.
  assert.deepEqual(decodeBuild('websites.landing~s.premium.coral.light.soft').style, {
    look: 'premium',
    accent: 'coral',
    theme: 'light',
    font: 'soft',
  })
  // Unknown ids are dropped, a kind-only link still opens.
  assert.deepEqual(decodeBuild('k.nope~p.adminbot-hack~y.neon.comic.round.tiny.loud.x'), {
    parts: {},
    extras: [],
    products: ['adminbot'],
  })
  assert.deepEqual(decodeBuild('k.barber'), { parts: {}, extras: [], kind: 'barber' })
  // Old and new style chunks can sit together.
  const both = decodeBuild('websites.landing~s._.coral~y.paper.mono')
  assert.deepEqual(both.style, { accent: 'coral', palette: 'paper', type: 'mono' })
})

test('quote: estimate() and the old combinations are unchanged', () => {
  assert.equal(estimate('websites', 'landing', ['telegram']), 170)
  assert.equal(estimate('bots', 'booking', ['payments']), 310)
  assert.equal(estimate('websites', 'shop', ['payments', 'cms']), 860)
  assert.equal(quote(presets.cafe).total, 480)
  // Kind, products and style never change a price.
  const bare = { parts: presets.cafe.parts, extras: presets.cafe.extras }
  assert.deepEqual(quote(presets.cafe), quote(bare))
  assert.deepEqual(quote({ ...bare, style: { kit: 'luxe' }, products: ['content'], kind: 'cafe' }), quote(bare))
})

test('lead summary: carries the kind and the products, within the form limit', () => {
  for (const [locale, dict] of locales) {
    const text = leadSummary(presets.barber, dict, locale)
    assert.match(text, new RegExp(`${builderUi.kindLabel[locale]}: ${kindCatalog.barber[locale][0]}`))
    assert.match(text, new RegExp(productCatalog.adminbot.name[locale]))
    const doc = estimateDoc(presets.barber, dict, locale)
    assert.equal(doc.kind, kindCatalog.barber[locale][0])
    assert.deepEqual(
      doc.products,
      kindCatalog.barber.products.map((id) => productCatalog[id].name[locale]),
    )
    const big = {
      ...presets.clinic,
      products: [...productIds],
      goals: [...buildGoals],
      style: { kit: 'wine', ...kits.wine },
      details: { wish: 'Очень длинное пожелание. '.repeat(30).slice(0, 300) },
    }
    assert.ok(leadSummary(big, dict, locale).length <= leadLimit)
  }
})

test('styles: enough palettes, type pairs and ready looks, all resolving to valid variables', () => {
  assert.ok(stylePalettes.length >= 12)
  assert.ok(styleTypes.length >= 6)
  assert.ok(styleKits.length >= 12)
  assert.equal(styleShapes.length, 3)
  assert.equal(styleDensities.length, 2)
  assert.equal(styleMoods.length, 4)
  const modes = new Set(stylePalettes.map((id) => palettes[id].mode))
  assert.deepEqual([...modes].sort(), ['dark', 'light'])
  for (const id of stylePalettes) {
    assert.ok(paletteNames[id].ru && paletteNames[id].en, id)
    assert.ok(Object.keys(palettes[id]).length === 7, id)
  }
  for (const id of styleTypes) assert.ok(typeNames[id].name.ru && typeTokens[id].head, id)
  for (const id of styleShapes) assert.ok(shapeNames[id].en && shapeTokens[id].button, id)
  for (const id of styleDensities) assert.ok(densityNames[id].ru, id)
  for (const id of styleMoods) assert.ok(moodNames[id].name.en && moodTokens[id].weight, id)
  for (const id of styleKits) {
    assert.ok(kitNames[id].name.ru && kitNames[id].name.en && kitNames[id].hint.ru, id)
    const k = kits[id]
    assert.ok(stylePalettes.includes(k.palette) && styleTypes.includes(k.type), id)
    assert.ok(styleShapes.includes(k.shape) && styleDensities.includes(k.density), id)
    assert.ok(styleMoods.includes(k.mood), id)
    const vars = styleVars({ kit: id, ...k })
    for (const [name, value] of Object.entries(vars)) {
      assert.ok(typeof value === 'string' && value && !/undefined|NaN/.test(value), `${id} ${name}`)
    }
    assert.equal(resolveLook({ kit: id }).palette, k.palette)
  }
  // The five axes combine freely: a palette × type × shape × density × mood grid has no holes.
  let combos = 0
  for (const palette of stylePalettes)
    for (const type of styleTypes)
      for (const shape of styleShapes)
        for (const density of styleDensities)
          for (const mood of styleMoods) {
            const vars = styleVars({ palette, type, shape, density, mood })
            assert.ok(!/undefined|NaN/.test(JSON.stringify(vars)))
            combos++
          }
  assert.ok(combos >= 2000, `${combos} combinations`)
})

test('styles: text stays readable on every palette', () => {
  const lum = (hex) => {
    const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const [r, g, b] = n.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  for (const id of stylePalettes) {
    const c = palettes[id]
    assert.ok(ratio(c.fg, c.bg) >= 7, `${id}: text on background`)
    assert.ok(ratio(c.ink, c.accent) >= 4.5, `${id}: text on the accent`)
    assert.ok(ratio(c.accent, c.bg) >= 3, `${id}: accent on background`)
  }
})

test('styles: legacy fields still resolve, ready looks and axes edit cleanly, price untouched', () => {
  const legacy = resolveLook({ look: 'premium', accent: 'coral', theme: 'light', font: 'soft' })
  assert.equal(legacy.palette, null)
  assert.equal(legacy.shape, 'sharp')
  assert.equal(legacy.mood, 'premium')
  assert.equal(legacy.type, 'serif')
  assert.equal(legacy.colors.mode, 'light')
  const base = { parts: presets.cafe.parts, extras: presets.cafe.extras }
  const kitBuild = applyKit(base, 'barber')
  assert.equal(kitBuild.style.kit, 'barber')
  assert.deepEqual(currentAxes(kitBuild.style), kits.barber)
  // Changing one axis keeps the rest and drops the look's name; matching a look again restores it.
  const tuned = setAxis(kitBuild, { mood: 'minimal' })
  assert.equal(tuned.style.kit, undefined)
  assert.equal(tuned.style.palette, 'graphite')
  assert.equal(setAxis(tuned, { mood: 'bold' }).style.kit, 'barber')
  assert.deepEqual(quote(tuned), quote(base))
  assert.deepEqual(decodeBuild(encodeBuild(tuned)), tuned)
})

test('mockup copy: preview text exists for every block in both languages', async () => {
  const { previewCopy } = await import('../src/content/builder-catalog.ts')
  assert.deepEqual(Object.keys(previewCopy.ru), Object.keys(previewCopy.en))
  assert.doesNotMatch(JSON.stringify(previewCopy), dashes)
  const mocks = new Set(kindIds.map((id) => kindCatalog[id].mock))
  for (const m of ['menu', 'booking', 'catalog', 'lesson', 'listing', 'trip', 'services', 'quote'])
    assert.ok(mocks.has(m), `a kind uses the ${m} block`)
})
