import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

// `server-only` throws outside Next; the proxy module is tested here with it stubbed.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    return next(specifier, context)
  },
})
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import { kindCatalog, kindIds } from '../src/content/builder-catalog.ts'
import {
  afterText, assetText, budgetText, channelText, clientTypeText, deadlineText, deliveryText, fearText,
  goalText, productIncludes, scripted, sourceText, themeText, moodText, toolText,
} from '../src/content/builder-v2.ts'
import {
  buildChannels, buildGoals, clientTools, decodeBuild, encodeBuild, presets, quote, toggleProduct, emptyBuild,
  themeIds, themeMoods, withLangs, withDetails,
} from '../src/lib/builder.ts'
import { familyGoalIds, goalFamilies } from '../src/lib/builder-ids.ts'
import { applyTheme, closestTheme, motionOf, resolveLook, setAxis, setThemeMood, styleVars } from '../src/lib/builder-style.ts'
import { kindTheme, kitTheme, themeAxes, themeMotion, themes } from '../src/lib/builder-themes.ts'
import {
  addonOrder, applySiteNeed, departmentOf, demoNicheOf, effectiveDelivery, goalsFor, hasAgent,
  hiddenByPriceRule, languageRuleBroken, previewModes, reapplySiteNeed, requiredDetails, stepIssues,
  toggleDelivery, visibleAddons, visibleExtras, deliveryOptions,
} from '../src/lib/builder-v2.ts'
import { briefOf, leadLimit, leadSummary } from '../src/lib/estimate-doc.ts'
import { defaultPricing } from '../src/lib/pricing.ts'
import { styleKits } from '../src/lib/builder.ts'

const lowLanguage = structuredClone(defaultPricing)
lowLanguage.catalog.websites.addons.language = 20

// ------------------------------------------------------------------ themes

test('themes: ten themes by genre, three moods each, a full motion preset', () => {
  assert.equal(themeIds.length, 10)
  assert.deepEqual([...themeMoods], ['calm', 'vivid', 'premium'])
  for (const id of themeIds) {
    assert.ok(themeText[id].name.ru && themeText[id].name.en, id)
    for (const mood of themeMoods) {
      const axes = themeAxes(id, mood)
      for (const key of ['palette', 'type', 'shape', 'density', 'mood']) assert.ok(axes[key], `${id}.${mood}.${key}`)
      const m = themeMotion(id, mood)
      assert.ok(['fade', 'rise', 'slide', 'scale'].includes(m.reveal))
      assert.ok(['none', 'soft', 'deep'].includes(m.parallax))
      assert.ok(['lift', 'press', 'glow', 'wiggle', 'none'].includes(m.micro))
      assert.ok(['photo', 'split', 'type', 'grid', 'cards', 'search'].includes(m.hero))
      assert.ok(m.duration > 0.2 && m.duration < 1.2)
    }
  }
  for (const name of ['Клиника', 'Салон', 'Кофейня', 'Магазин', 'Юристы', 'IT-сервис', 'Фитнес', 'Образование', 'Недвижимость', 'Ремонт и услуги'])
    assert.ok(themeIds.some((id) => themeText[id].name.ru === name), name)
  for (const mood of themeMoods) assert.ok(moodText[mood].name.ru)
})

test('themes: the three moods differ and the themes differ in motion, so the mockup visibly changes', () => {
  for (const id of themeIds) {
    const looks = new Set(themeMoods.map((m) => JSON.stringify(themeAxes(id, m))))
    assert.equal(looks.size, 3, `${id}: moods must differ`)
  }
  const heroes = new Set(themeIds.map((id) => themeMotion(id).hero))
  assert.ok(heroes.size >= 5, 'hero kinds')
  const motions = new Set(themeIds.map((id) => JSON.stringify(themeMotion(id))))
  assert.ok(motions.size >= 8, 'motion presets')
  assert.notEqual(styleVars({ themeId: 'clinic' })['--color-bg'], styleVars({ themeId: 'fitness', themeMood: 'vivid' })['--color-bg'])
  assert.notDeepEqual(motionOf({ themeId: 'it' }), motionOf({ themeId: 'legal' }))
  assert.deepEqual(motionOf(undefined), motionOf({}))
})

test('theme: palette and fonts stay tunable inside it', () => {
  const build = applyTheme(emptyBuild, 'clinic', 'calm')
  assert.deepEqual(build.style, { themeId: 'clinic', themeMood: 'calm' })
  assert.equal(resolveLook(build.style).palette, 'skylight')
  const tuned = setAxis(build, { palette: 'noir', type: 'serif' })
  assert.equal(tuned.style.themeId, 'clinic')
  const look = resolveLook(tuned.style)
  assert.equal(look.palette, 'noir')
  assert.equal(look.type, 'serif')
  assert.equal(look.shape, 'soft', 'the rest still follows the theme')
  assert.equal(setThemeMood(applyTheme(emptyBuild, 'salon'), 'premium').style.themeMood, 'premium')
})

test('old style chunks map to the closest theme, the link itself is not rewritten', () => {
  for (const kit of styleKits) {
    const t = closestTheme({ kit })
    assert.ok(themeIds.includes(t.id), kit)
    assert.equal(t.id, kitTheme[kit])
  }
  assert.equal(closestTheme({ kit: 'clinic' }).id, 'clinic')
  assert.equal(closestTheme({ kit: 'coffee' }).id, 'coffee')
  // legacy `s.` chunk: premium + amber + dark + soft font
  const legacy = decodeBuild('websites.landing~k.cafe~s.premium.amber.dark.soft')
  const near = closestTheme(legacy.style, legacy.kind)
  assert.ok(themeIds.includes(near.id) && themeMoods.includes(near.mood))
  assert.equal(near.mood, 'premium')
  // `y.` chunk with axes, no kit
  const axes = decodeBuild('websites.landing~y.noir.serif.sharp.airy.premium._')
  assert.equal(closestTheme(axes.style).mood, 'premium')
  assert.ok(['salon', 'realty'].includes(closestTheme(axes.style).id))
  // no style: the niche's own theme
  assert.equal(closestTheme(undefined, 'salon').id, kindTheme.salon)
  assert.equal(closestTheme(undefined), null)
  // old links still encode as they were
  const before = encodeBuild(legacy)
  closestTheme(legacy.style)
  assert.equal(encodeBuild(legacy), before)
  assert.match(before, /~s\.premium\.amber\.dark\.soft/)
  assert.doesNotMatch(before, /~t\./)
  assert.ok(motionOf(legacy.style).duration > 0)
})

test('every niche has a theme', () => {
  for (const id of kindIds) assert.ok(themes[kindTheme[id]], id)
})

// ------------------------------------------------------------------- goals

test('goals: at least six outcomes per product family, every id has RU and EN text', () => {
  for (const family of goalFamilies) assert.ok(familyGoalIds[family].length >= 6, family)
  for (const id of buildGoals) {
    assert.ok(goalText[id]?.name.ru && goalText[id]?.name.en && goalText[id]?.hint.ru && goalText[id]?.hint.en, id)
  }
  assert.equal(new Set(buildGoals).size, buildGoals.length)
})

test('goals follow the product and the niche', () => {
  const salonAgent = goalsFor(toggleProduct({ ...presets.salon, products: [], parts: {} }, 'adminbot'))
  const shopSite = goalsFor({ ...presets.shop, products: ['site'] })
  const content = goalsFor({ ...presets.coffee, products: ['content'] })
  assert.ok(salonAgent.length >= 6 && shopSite.length >= 6 && content.length >= 6)
  assert.ok(salonAgent.includes('noshow') && salonAgent.includes('nocalls'))
  assert.ok(shopSite.includes('onlineorder') && !shopSite.includes('noshow'))
  assert.ok(content.includes('regular') && !content.includes('noshow'))
  assert.notDeepEqual(salonAgent, shopSite)
  // the niche reorders: a salon sees fewer no-shows before the generic FAQ goal
  assert.ok(salonAgent.indexOf('noshow') < salonAgent.indexOf('faqoff'))
  assert.ok(goalsFor({ parts: {}, extras: [] }).length >= 6)
  // goals already ticked stay
  assert.ok(goalsFor({ ...presets.salon, goals: ['regular'] }).includes('regular'))
})

test('goals: the administrator, the lead manager and the assistant each have their own set of 7-8, the rest have 7 or more', () => {
  for (const family of ['admin', 'leadmgr', 'assistant']) assert.ok(familyGoalIds[family].length >= 7 && familyGoalIds[family].length <= 8, family)
  for (const family of ['site', 'automation', 'content', 'miniapp', 'department', 'app']) assert.ok(familyGoalIds[family].length >= 7, family)
  const only = (id) => goalsFor(toggleProduct({ parts: {}, extras: [] }, id))
  const admin = only('adminbot')
  const lead = only('intake')
  const assistant = only('personal')
  assert.ok(admin.includes('noshow') && admin.includes('nocalls'))
  assert.ok(!lead.includes('noshow') && !lead.includes('nocalls'), 'no «Меньше неявок» for the lead manager')
  assert.ok(lead.includes('qualify') && lead.includes('followup'))
  assert.ok(assistant.includes('deadlines') && assistant.includes('inbox') && !assistant.includes('leadcollect') && !assistant.includes('noshow'))
  assert.notDeepEqual(admin, lead)
  assert.notDeepEqual(lead, assistant)
})

test('extras: no mailings or payments for the lead manager outside a shop or a clinic; three new extras from existing prices', () => {
  const lead = toggleProduct({ parts: {}, extras: [] }, 'intake')
  const cafe = { ...lead, kind: 'cafe' }
  assert.ok(!visibleAddons(cafe, 'bots').includes('broadcasts') && !visibleAddons(cafe, 'bots').includes('payments'))
  for (const kind of ['shop', 'clinic']) assert.ok(visibleAddons({ ...lead, kind }, 'bots').includes('payments'), kind)
  // the administrator keeps them
  assert.ok(visibleAddons({ ...toggleProduct({ parts: {}, extras: [] }, 'adminbot'), kind: 'cafe' }, 'bots').includes('payments'))
  const extras = visibleExtras({ parts: { websites: { variant: 'landing', addons: [] }, apps: { variant: 'pwa', addons: [] } }, extras: [] })
  for (const id of ['crm', 'internal', 'rescue']) assert.ok(extras.includes(id), id)
  const q = quote({ parts: { websites: { variant: 'landing', addons: [] } }, extras: ['rescue', 'crm', 'internal'] }, defaultPricing)
  assert.deepEqual(q.lines.slice(1).map((l) => l.price), [defaultPricing.extras.rescue, defaultPricing.catalog.automation.variants.crm, defaultPricing.catalog.apps.variants.internal])
  assert.equal(decodeBuild(encodeBuild({ parts: { websites: { variant: 'landing', addons: [] } }, extras: ['rescue', 'crm'] })).extras.join(), 'rescue,crm')
})

test('the preview chat label follows the chosen agent product and the step numbering is one style', () => {
  const live = readFileSync('src/components/builder-live-preview.tsx', 'utf8')
  assert.match(live, /productCatalog\[agentId\]\.name/)
  const ui = readFileSync('src/components/builder-ui.tsx', 'utf8')
  const nav = readFileSync('src/components/builder-nav.tsx', 'utf8')
  assert.doesNotMatch(ui, /padStart/)
  assert.doesNotMatch(nav, /padStart/)
  assert.match(ui, /\{label\} \{index \+ 1\} \{of\} \{total\}/)
  assert.match(ru.builder.stepLabel + ' 1 ' + ru.builder.of + ' 8', /^Шаг 1 из 8$/)
})

test('channels: twelve with a one-line hint each', () => {
  assert.equal(buildChannels.length, 12)
  for (const id of buildChannels) assert.ok(channelText[id].hint.ru.length > 5 && channelText[id].hint.en.length > 5, id)
})

// ------------------------------------------------------------------ extras

test('extras: the receptionist never sees «заявки в Telegram», included options are not offered again', () => {
  const salon = { ...presets.salon }
  assert.ok(visibleAddons(salon, 'websites').includes('telegram'), 'a plain site offers it')
  const receptionist = toggleProduct({ parts: {}, extras: [] }, 'intake')
  const withSite = toggleProduct(receptionist, 'site')
  assert.ok(!visibleAddons(withSite, 'websites').includes('telegram'))
  assert.ok(!visibleAddons(withSite, 'bots').includes('ai'), 'the receptionist already includes the AI option')
  const admin = toggleProduct({ parts: {}, extras: [] }, 'adminbot')
  assert.ok(!visibleAddons(admin, 'bots').includes('broadcasts'), 'the administrator includes broadcasts')
  assert.ok(visibleAddons(admin, 'bots').includes('payments'))
})

test('extras: the content product never sees a second language unless a site is in the build', () => {
  const content = toggleProduct({ parts: {}, extras: [] }, 'content')
  for (const slug of ['websites', 'bots', 'apps', 'automation']) assert.deepEqual(visibleAddons(content, slug), [])
  assert.ok(!visibleExtras(content).includes('seo'), 'no search extra without a site')
  const withSite = { ...content, parts: { websites: { variant: 'landing', addons: [] } } }
  assert.ok(visibleExtras(withSite).includes('seo'))
  // with a site, the language option follows the owner's price rule (below)
  assert.ok(!visibleAddons(withSite, 'websites').includes('language'))
  assert.ok(visibleAddons(withSite, 'websites', lowLanguage).includes('language'))
})

test('extras: a second language cannot cost more than a lead channel; the option is hidden, prices untouched', () => {
  assert.equal(defaultPricing.catalog.websites.addons.language, 40)
  assert.equal(defaultPricing.catalog.websites.addons.telegram, 20)
  assert.equal(languageRuleBroken(defaultPricing), true)
  assert.deepEqual(hiddenByPriceRule(defaultPricing), [{ service: 'websites', id: 'language', price: 40, limit: 20 }])
  assert.equal(languageRuleBroken(lowLanguage), false)
  assert.deepEqual(hiddenByPriceRule(lowLanguage), [])
  const site = { parts: { websites: { variant: 'landing', addons: [] } }, extras: [] }
  assert.ok(!visibleAddons(site, 'websites').includes('language'))
  // a preset that already carries it keeps showing it, so it can be removed
  const travel = presets.travel
  assert.ok(travel.parts.websites.addons.includes('language'))
  assert.ok(visibleAddons(travel, 'websites').includes('language'))
  // the languages chips only record a note while the option is hidden
  const two = withLangs(site, ['ru', 'en'], false)
  assert.deepEqual(two.parts.websites.addons, [])
  assert.deepEqual(quote(two), quote(site))
  assert.deepEqual(withLangs(site, ['ru', 'en']).parts.websites.addons, ['language'], 'the pure helper is unchanged')
})

test('extras come in a sanity order', () => {
  const full = { parts: { websites: { variant: 'shop', addons: [] }, bots: { variant: 'faq', addons: [] } }, extras: [] }
  assert.deepEqual(visibleAddons(full, 'websites', lowLanguage), ['cms', 'payments', 'telegram', 'language'])
  assert.deepEqual(visibleAddons(full, 'bots'), ['ai', 'broadcasts', 'payments', 'admin'])
  assert.deepEqual(visibleExtras(full), ['seo', 'design', 'crm', 'rescue', 'support'])
  // Internal systems only next to automation or an app; CRM not when the build already is the CRM format.
  assert.ok(visibleExtras({ ...full, parts: { ...full.parts, automation: { variant: 'integration', addons: [] } } }).includes('internal'))
  assert.ok(!visibleExtras({ ...full, parts: { ...full.parts, automation: { variant: 'crm', addons: [] } } }).includes('crm'))
  for (const slug of Object.keys(addonOrder)) assert.ok(addonOrder[slug].length === 4)
})

// ------------------------------------------------------- agent without a site

test('agent without a site: the site goes, never comes back, delivery offers the playground', () => {
  let build = presets.salon
  assert.ok(build.parts.websites && build.products.includes('site'))
  assert.ok(hasAgent(build))
  build = applySiteNeed(build, 'no')
  assert.equal(build.parts.websites, undefined)
  assert.ok(!build.products.includes('site'))
  assert.ok(!build.extras.includes('seo'))
  assert.equal(build.siteNeed, 'no')
  // choosing another niche re-applies the answer
  const other = reapplySiteNeed({ ...presets.cafe, siteNeed: 'no' })
  assert.equal(other.parts.websites, undefined)
  assert.ok(!other.products.includes('site'))
  const ids = deliveryOptions(build).map((o) => o.id)
  assert.deepEqual(ids, ['telegram', 'whatsapp', 'playground'])
  assert.ok(deliveryOptions(build).find((o) => o.id === 'whatsapp').disabled)
  assert.deepEqual(effectiveDelivery(build), ['telegram'], 'Telegram is the default')
  const pg = toggleDelivery(toggleDelivery(build, 'telegram'), 'playground')
  assert.deepEqual(pg.delivery, ['playground'])
  assert.deepEqual(previewModes(pg), ['playground'])
  assert.deepEqual(previewModes(build), ['agent'])
  assert.ok(!previewModes(build).includes('site'))
  assert.deepEqual(toggleDelivery(pg, 'playground').delivery, [], 'an empty choice is kept')
  assert.deepEqual(stepIssues(toggleDelivery(pg, 'playground'), 3), ['delivery'])
  // `have`: connect to an existing site, widget allowed
  const have = applySiteNeed(presets.salon, 'have')
  assert.equal(have.parts.websites, undefined)
  assert.ok(deliveryOptions(have).some((o) => o.id === 'widget'))
  // `need` puts a site back
  assert.ok(applySiteNeed(build, 'need').parts.websites)
  // the lead text carries the choice
  const text = leadSummary(withDetails(pg, { company: 'Лола' }), ru, 'ru')
  assert.match(text, /Где живёт: Площадка Fir Tech/)
  assert.match(text, /Сайт: Сайт не нужен/)
  assert.match(leadSummary(withDetails(pg, { company: 'Лола' }), en, 'en'), /Where it lives: Fir Tech playground/)
})

test('preview modes: the view follows the products', () => {
  assert.deepEqual(previewModes(toggleProduct(emptyBuild, 'aiteam')), ['department', 'automation'])
  assert.deepEqual(previewModes(toggleProduct(emptyBuild, 'miniapp')), ['miniapp'])
  assert.deepEqual(previewModes(toggleProduct(emptyBuild, 'content')), ['content'])
  assert.deepEqual(previewModes(toggleProduct(emptyBuild, 'site')), ['site'])
  assert.deepEqual(previewModes(emptyBuild), ['site'])
  assert.equal(departmentOf({ ...emptyBuild, goals: ['regular'] }), 'marketing')
  assert.equal(departmentOf(emptyBuild), 'support')
  assert.equal(demoNicheOf('salon'), 'salon')
  assert.equal(demoNicheOf('clinic'), 'clinic')
  assert.equal(demoNicheOf('webshop'), 'shop')
  assert.equal(demoNicheOf('cafe'), 'cafe')
  assert.equal(demoNicheOf('tutor'), 'courses')
  assert.equal(demoNicheOf('carwash'), 'service')
  for (const niche of ['salon', 'clinic', 'shop', 'cafe', 'service', 'courses'])
    for (const loc of ['ru', 'en']) {
      const s = scripted[niche][loc]
      assert.equal(s.chips.length, s.answers.length)
      assert.match(s.greeting, /\{company\}/)
    }
})

// ---------------------------------------------------------------- required

test('required fields block «Дальше» with a reason', () => {
  assert.deepEqual(stepIssues(emptyBuild, 0), ['kind'])
  assert.deepEqual(stepIssues(presets.cafe, 0), [])
  assert.deepEqual(stepIssues(emptyBuild, 1), ['products'])
  assert.deepEqual(stepIssues(toggleProduct(emptyBuild, 'adminbot'), 1), ['site'], 'an agent asks about a site first')
  assert.deepEqual(stepIssues(applySiteNeed(toggleProduct(emptyBuild, 'adminbot'), 'no'), 1), [])
  assert.deepEqual(stepIssues(presets.salon, 1), [], 'a site in the build answers it')
  assert.deepEqual(stepIssues(presets.salon, 2), ['goals'])
  assert.deepEqual(stepIssues({ ...presets.salon, goals: ['noshow'] }, 2), [])
  assert.deepEqual(stepIssues(presets.salon, 6), ['company', 'clients', 'owner', 'deadline', 'after'])
  const shop = presets.shop
  assert.deepEqual(requiredDetails(shop), ['company', 'clients', 'owner', 'deadline'], 'no «after» without an agent')
  const done = withDetails(shop, { company: 'Дукон', clientTypes: ['private'], owner: 'Азиза', deadline: 'w2' })
  assert.deepEqual(requiredDetails(done), [])
  assert.deepEqual(requiredDetails(withDetails(shop, { company: ' ', clients: 'Женщины 25-40', owner: 'А', deadline: 'asap' })), ['company'])
  assert.deepEqual(stepIssues(done, 6), [])
  assert.deepEqual(stepIssues(done, 5), [])
  assert.ok(Object.keys(deadlineText).includes('w2'))
})

// ------------------------------------------------------------- link and lead

const rich = {
  kind: 'salon',
  products: ['adminbot', 'content'],
  parts: { bots: { variant: 'booking', addons: ['broadcasts'] } },
  extras: ['design'],
  goals: ['noshow', 'nocalls', 'leads'],
  channels: ['instagram', 'maps', 'tiktok', 'whatsapp', 'partners'],
  delivery: ['telegram', 'playground'],
  siteNeed: 'no',
  style: { themeId: 'salon', themeMood: 'premium', palette: 'noir', type: 'serif' },
  details: {
    langs: ['ru', 'en'],
    has: ['logo', 'access'],
    deadline: 'quarter',
    company: 'Лола',
    clients: 'Женщины 25-40, живут рядом, ценят время',
    clientTypes: ['private', 'family'],
    sources: ['msgs', 'recs'],
    after: ['notify', 'slot', 'remind'],
    tools: ['sheets', 'kaspi', 'amocrm'],
    owner: 'Азиза, управляющая',
    fears: ['aimistake', 'support'],
    budget: 'b1k',
    examples: ['example.com'],
    wish: 'Хочу, чтобы агент говорил мягко',
  },
}

test('?b= round trip with the new details, delivery, site answer and theme', () => {
  const code = encodeBuild(rich)
  assert.deepEqual(decodeBuild(code), rich)
  assert.match(code, /~t\.salon\.premium/)
  assert.match(code, /~l\.telegram-playground/)
  assert.match(code, /~z\.no/)
  assert.match(code, /~u\.eyJ/, 'the new details are one base64url JSON chunk starting with {')
  assert.ok(code.length < 1800, `link length ${code.length}`)
  // the page count is gone: an old d.5 link decodes without it and re-encodes with `_`
  const old = decodeBuild('websites.landing~k.cafe~d.5.ru-en.logo.month')
  assert.deepEqual(old.details, { langs: ['ru', 'en'], has: ['logo'], deadline: 'month' })
  assert.match(encodeBuild(old), /~d\._\.ru-en\.logo\.month/)
  // an empty delivery choice survives, a missing one stays missing
  assert.deepEqual(decodeBuild(encodeBuild({ ...rich, delivery: [] })).delivery, [])
  assert.equal(decodeBuild(encodeBuild({ ...rich, delivery: undefined })).delivery, undefined)
})

test('?b= JSON details: unknown ids dropped, free text cleaned and capped, huge input stays short', () => {
  const evil = Buffer.from(JSON.stringify({ co: '<b>Лола</b>\n\n', ow: 'x'.repeat(500), ct: ['private', 'hacker'], bu: 'nope', af: 'notify', zz: 1 })).toString('base64url')
  const d = decodeBuild(`websites.landing~u.${evil}`).details
  assert.equal(d.company, '<b>Лола</b>')
  assert.equal(d.owner.length, 80)
  assert.deepEqual(d.clientTypes, ['private'])
  assert.equal(d.budget, undefined)
  assert.equal(d.after, undefined)
  const bad = decodeBuild(`websites.landing~u.${Buffer.from('{not json').toString('base64url')}`)
  assert.equal(bad.details, undefined)
  const big = { ...rich, details: { ...rich.details, clients: 'я'.repeat(160), owner: 'о'.repeat(80), company: 'к'.repeat(40) } }
  const code = encodeBuild(big)
  assert.ok(code.length < 2600, `link length ${code.length}`)
  const back = decodeBuild(code)
  assert.ok(back.details.company && back.details.deadline)
})

test('leadSummary: a maximal v2 brief stays within the cap, in both languages, and keeps what matters', () => {
  for (const [dict, locale] of [[ru, 'ru'], [en, 'en']]) {
    const text = leadSummary(rich, dict, locale)
    assert.ok(text.length <= leadLimit, `${locale}: ${text.length}`)
    assert.match(text, /Лола/)
    assert.match(text, locale === 'ru' ? /Площадка Fir Tech/ : /Fir Tech playground/)
    assert.match(text, new RegExp(dict.builder.total + ': '))
  }
  // a long wish and lots of chips are summarised, never overflow
  const huge = withDetails(rich, { wish: 'очень длинное пожелание '.repeat(30).slice(0, 300), examples: ['example.com/' + 'a'.repeat(80), 'b.example.com/' + 'c'.repeat(80)], tools: [...clientTools] })
  const allParts = {
    websites: { variant: 'shop', addons: ['language', 'telegram', 'payments', 'cms'] },
    bots: { variant: 'miniapp', addons: ['payments', 'broadcasts', 'admin', 'ai'] },
    apps: { variant: 'mobile', addons: ['accounts', 'payments', 'push', 'admin'] },
    automation: { variant: 'assistant', addons: ['sheets', 'alerts', 'training', 'support'] },
  }
  const text = leadSummary({ ...huge, goals: [...buildGoals], channels: [...buildChannels], parts: allParts }, ru, 'ru')
  assert.ok(text.length <= leadLimit, `${text.length}`)
  assert.match(text, /Лола/, 'the business name survives summarising')
})

test('brief rows for the new details', () => {
  const brief = briefOf(rich, ru, 'ru')
  const ids = brief.details.map((r) => r.id)
  for (const id of ['company', 'clients', 'owner', 'deadline', 'after', 'sources', 'tools', 'has', 'fears', 'budget', 'langs', 'wish'])
    assert.ok(ids.includes(id), id)
  assert.ok(!ids.includes('pages'))
  assert.deepEqual(brief.setup.map((r) => r.id), ['delivery', 'site'])
  assert.match(brief.style[0].value, /Салон, премиум/)
})

test('prices never move with the new answers', () => {
  const bare = { parts: rich.parts, extras: rich.extras, products: rich.products }
  assert.deepEqual(quote(rich), quote(bare))
  assert.deepEqual(quote(applyTheme(presets.salon, 'fitness', 'vivid')), quote(presets.salon))
})

// -------------------------------------------------------------- words

test('no «конструктор» or «калькулятор» in the builder UI copy, no long dashes', () => {
  const files = [
    'src/content/builder-v2.ts',
    'src/lib/builder-v2.ts',
    ...readdirSync('src/components').filter((f) => f.startsWith('builder') && f.endsWith('.tsx')).map((f) => `src/components/${f}`),
  ]
  const word = /конструктор|калькулятор|constructor|calculator/i
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    // the comment that states the rule itself is allowed
    const body = text.split('\n').filter((l) => !l.includes('never appear here')).join('\n')
    assert.doesNotMatch(body, word, file)
  }
  const catalog = readFileSync('src/content/builder-catalog.ts', 'utf8')
  const ui = catalog.slice(catalog.indexOf('export const builderUi'), catalog.indexOf('export type PreviewCopy'))
  assert.doesNotMatch(ui, word)
  for (const dict of [ru, en]) {
    assert.doesNotMatch(JSON.stringify(dict.builder), word)
    assert.doesNotMatch(JSON.stringify(dict.builder), /[–—]/)
  }
  const v2 = readFileSync('src/content/builder-v2.ts', 'utf8')
  assert.doesNotMatch(v2.replace(/\/\/.*$/gm, ''), /[–—]/)
  // chip and text tables are complete in both languages
  for (const table of [clientTypeText, sourceText, afterText, toolText, fearText, budgetText, assetText, deadlineText])
    for (const entry of Object.values(table)) assert.ok(entry.ru && entry.en)
  for (const id of Object.keys(deliveryText)) assert.ok(deliveryText[id].name.ru && deliveryText[id].hint.en)
  for (const id of Object.keys(productIncludes)) assert.equal(productIncludes[id].ru.length, 3)
  assert.ok(kindCatalog.salon && Object.keys(kindCatalog).length >= 50)
})

test('the playground proxy: validation, no token, scripted fallback without HQ', async () => {
  const { agentDemoSchema, agentDemoUrl, askDemoAgent, createDemoLimiter } = await import('../src/lib/agent-demo.ts')
  assert.ok(agentDemoSchema.safeParse({ niche: 'salon', sessionId: 'abcdefgh12', text: 'Привет' }).success)
  assert.ok(!agentDemoSchema.safeParse({ niche: 'bank', sessionId: 'abcdefgh12', text: 'x' }).success)
  assert.ok(!agentDemoSchema.safeParse({ niche: 'salon', sessionId: 'short', text: 'x' }).success)
  assert.ok(!agentDemoSchema.safeParse({ niche: 'salon', sessionId: 'abcdefgh12', text: 'x'.repeat(501) }).success)
  assert.equal(agentDemoUrl({ NODE_ENV: 'development' }, 'salon'), null)
  assert.equal(agentDemoUrl({ NODE_ENV: 'production' }, 'salon'), 'http://127.0.0.1:8787/agent/demo-salon/chat')
  assert.equal(agentDemoUrl({ HQ_CHAT_URL: 'http://hq:8787/chat', NODE_ENV: 'production' }, 'clinic'), 'http://hq:8787/agent/demo-clinic/chat')
  assert.deepEqual(await askDemoAgent({ niche: 'salon', sessionId: 'abcdefgh12', text: 'a' }, { NODE_ENV: 'development' }), { ok: false, error: 'mock' })
  let sent
  const ok = await askDemoAgent(
    { niche: 'shop', sessionId: 'abcdefgh12', text: 'есть?' },
    { NODE_ENV: 'production' },
    async (url, init) => {
      sent = { url, init }
      return new Response(JSON.stringify({ ok: true, reply: '<b>Да</b>, есть', usedTools: [] }), { status: 200 })
    },
    '1.2.3.4',
  )
  assert.deepEqual(ok, { ok: true, reply: 'Да, есть' })
  assert.equal(sent.url, 'http://127.0.0.1:8787/agent/demo-shop/chat')
  assert.equal(sent.init.headers['x-visitor-ip'], '1.2.3.4')
  assert.equal(sent.init.headers['x-chat-token'], undefined)
  // every demo call carries the flag; without an account (identity null) no client fields
  assert.deepEqual(JSON.parse(sent.init.body), { sessionId: 'abcdefgh12', text: 'есть?', demo: true })
  const down = await askDemoAgent({ niche: 'shop', sessionId: 'abcdefgh12', text: 'a' }, { NODE_ENV: 'production' }, async () => { throw new Error('down') })
  assert.equal(down.ok, false)
  const limited = createDemoLimiter(2, 1000)
  assert.deepEqual([limited('ip', 0), limited('ip', 1), limited('ip', 2), limited('other', 2), limited('ip', 1500)], [false, false, true, false, false])
})

// ------------------------------------------------- v4: personal path and discovery

const personalMod = await import('../src/lib/builder-personal.ts')
const personalCopy = await import('../src/content/builder-personal.ts')
const { leadBody } = await import('../src/lib/lead-forward.ts')
const { leadSchema } = await import('../src/lib/lead.ts')
const { leadServiceOf } = await import('../src/lib/builder.ts')
const { estimateDoc, leadEstimateFields } = await import('../src/lib/estimate-doc.ts')
const { flagshipPrice, personalLevel } = await import('../src/lib/flagships.ts')

const fullPersonal = () => {
  let b = personalMod.startPersonal(emptyBuild)
  b = personalMod.withPersonal(b, {
    who: 'student', hand: ['mail', 'calendar', 'study', 'reminders'], where: ['telegram', 'webchat', 'voice'],
    connect: ['google', 'moodle'], tone: [0, 2, 1], tier: 'plus',
  })
  return personalMod.withDiscovery(b, { hours: 'h9', tz: 'UTC+5', pains: ['time', 'manual'], success: ['calm'], heard: 'friend', instagram: '@fir.tech' })
}

test('personal: fork starts and stops the personal path', () => {
  const p = personalMod.startPersonal({ ...emptyBuild, kind: 'salon' })
  assert.ok(p.personal && p.products?.[0] === 'personal' && !p.kind)
  const back = personalMod.stopPersonal(p)
  assert.ok(!back.personal && !back.products && !back.options)
})

test('personal: encode and decode keep the brief and the discovery, drop unknown ids', () => {
  const b = fullPersonal()
  const back = decodeBuild(encodeBuild(b))
  assert.deepEqual(back.personal, b.personal)
  assert.deepEqual(back.discovery, b.discovery)
  assert.match(encodeBuild(b), /(^|~)m\./)
  assert.match(encodeBuild(b), /(^|~)v\./)
  const junk = personalMod.personalJson({ who: 'alien', hand: ['mail', 'zzz'], tier: 'gold' })
  assert.deepEqual(personalMod.parsePersonalJson(junk), { hand: ['mail'] })
  assert.equal(personalMod.parsePersonalJson('not json'), undefined)
  // a link with only an empty personal chunk still opens the personal path
  assert.deepEqual(decodeBuild(encodeBuild(personalMod.startPersonal(emptyBuild))).personal, {})
  assert.ok(personalMod.personalJson(fullPersonal().personal).length <= personalMod.personalLimit)
  const huge = personalMod.discoveryJson({ tz: 'x'.repeat(30), site: 'a.' + 'b'.repeat(95), instagram: '@' + 'c'.repeat(90), pains: [...'calls lost slow manual noshow reports chaos time content money'.split(' ')], success: ['leads', 'time', 'lost', 'revenue', 'calm', 'control'] })
  assert.ok(huge.length <= personalMod.discoveryLimit)
  // old business links decode as before: no personal, no discovery
  const old = decodeBuild(encodeBuild(presets.salon))
  assert.ok(!old.personal && !old.discovery)
})

test('personal: required answers, tier from handed-over areas, price from pricing', () => {
  const b = personalMod.startPersonal(emptyBuild)
  assert.deepEqual(personalMod.personalIssues(b, 0), ['who'])
  assert.deepEqual(personalMod.personalIssues(b, 1), ['hand'])
  assert.deepEqual(personalMod.personalIssues(b, 2), ['where'])
  assert.deepEqual(personalMod.personalIssues(b, 4), [])
  assert.ok(personalMod.personalReady(fullPersonal()))
  assert.equal(personalMod.suggestedTier({ hand: ['mail'] }), 'basic')
  assert.equal(personalMod.suggestedTier({ hand: ['mail', 'calendar', 'study'] }), 'plus')
  assert.equal(personalMod.suggestedTier({ hand: [...'mail calendar study money health languages'.split(' ')] }), 'max')
  // the picked tier decides the flagship level, so the existing price helper stays the one source
  for (const tier of ['basic', 'plus', 'max']) {
    const t = personalMod.withPersonal(fullPersonal(), { tier })
    assert.equal(personalLevel(t.options.personal), tier)
    assert.equal(flagshipPrice(t, 'personal').plan.setup, defaultPricing.personalPlans[tier].setup)
  }
})

test('personal: day timeline follows the choices', () => {
  const rows = personalMod.dayTimeline({ hand: ['study', 'mail', 'languages'] })
  assert.equal(rows[0].hand, 'start')
  assert.equal(rows.at(-1).hand, 'end')
  assert.deepEqual(rows.slice(1, -1).map((r) => r.hand), ['mail', 'study', 'languages'])
  assert.equal(personalMod.dayTimeline({ hand: [...'mail calendar study money health languages content home docs'.split(' ')] }).length, 8)
  for (const hand of Object.keys(personalCopy.dayUi.rows)) assert.ok(personalCopy.dayUi.rows[hand].ru && personalCopy.dayUi.rows[hand].en)
})

test('personal: lead summary stays inside the limit, brief first, tier named, no Telegram default', () => {
  const b = fullPersonal()
  for (const locale of ['ru', 'en']) {
    const dict = locale === 'ru' ? ru : en
    const text = leadSummary(b, dict, locale, defaultPricing)
    assert.ok(text.length <= leadLimit)
    assert.match(text, locale === 'ru' ? /Второй пилот/ : /Co-pilot/)
    const rows = briefOf(b, dict, locale).setup
    assert.ok(rows.length >= 5 && rows.every((r) => r.id.startsWith('p-')))
    const fields = leadEstimateFields(b, dict, locale, defaultPricing)
    assert.ok(fields.estimate.length <= 1500 && (fields.message ?? '').length <= 1500)
  }
  // worst case: every list full, still bounded
  const full = personalMod.withDiscovery(personalMod.withPersonal(fullPersonal(), { hand: [...'mail calendar study money health languages content home docs reminders calls search'.split(' ')], connect: [...'google microsoft apple moodle notion telegram whatsapp bank other'.split(' ')], where: [...'telegram whatsapp webchat cabinet voice email desktop'.split(' ')] }), { pains: [...'calls lost slow manual noshow reports chaos time content money'.split(' ')] })
  assert.ok(leadSummary(full, ru, 'ru', defaultPricing).length <= leadLimit)
  assert.equal(leadServiceOf(b), 'personal')
  assert.equal(estimateDoc(b, ru, 'ru', defaultPricing).onRequest[0].price.startsWith('Второй пилот: $'), true)
})

test('lead payload carries the brief (business and personal), bounded, HQ-compatible', () => {
  const personal = personalMod.leadBriefOf(fullPersonal())
  assert.equal(personal.type, 'personal')
  assert.equal(personal.tier, 'plus')
  assert.deepEqual(personal.tone, { formality: 0, brevity: 2, initiative: 1 })
  assert.equal(personal.discovery.hours, 'h9')
  let biz = applySiteNeed(toggleProduct(presets.salon, 'adminbot'), 'no')
  biz = withDetails(biz, { company: 'Лола', deadline: 'w2' })
  biz = personalMod.withDiscovery(biz, { size: 's5', leads: 'd20' })
  const business = personalMod.leadBriefOf(biz)
  assert.equal(business.type, 'business')
  assert.equal(business.niche, 'salon')
  assert.equal(business.details.company, 'Лола')
  assert.equal(business.discovery.leads, 'd20')
  assert.ok(JSON.stringify(business).length <= personalMod.leadBriefLimit)
  assert.equal(personalMod.leadBriefOf(emptyBuild), null)
  const base = { name: 'A', contact: 'a@b.cc', locale: 'ru' }
  const parsed = leadSchema.parse({ ...base, brief: personal })
  assert.deepEqual(parsed.brief, personal)
  assert.ok(!leadSchema.safeParse({ ...base, brief: { v: 1, junk: 'x'.repeat(4000) } }).success)
  assert.equal(leadSchema.parse(base).brief, undefined)
  assert.deepEqual(leadBody({ ...parsed, siteLeadId: undefined }, undefined).brief, personal)
  assert.equal('brief' in leadBody(leadSchema.parse(base), undefined), false)
})

test('discovery copy: every id has RU and EN, no dashes, no «конструктор»', () => {
  const ids = await_ids()
  function await_ids() { return import('../src/lib/builder-ids.ts') }
  return ids.then((m) => {
    const tables = [
      [m.discSizes, personalCopy.sizeText], [m.discLeads, personalCopy.leadsText], [m.discBase, personalCopy.baseText],
      [m.discHours, personalCopy.hoursText], [m.discApprover, personalCopy.approverText], [m.discPains, personalCopy.painText],
      [m.discSuccess, personalCopy.successText], [m.discHeard, personalCopy.heardText], [m.personalConnect, personalCopy.connectText],
    ]
    for (const [list, copy] of tables) for (const id of list) assert.ok(copy[id]?.ru && copy[id]?.en, id)
    for (const id of m.personalWho) assert.ok(personalCopy.whoText[id].name.ru)
    for (const id of m.personalHand) assert.ok(personalCopy.handText[id].name.en)
    for (const id of m.personalChannels) assert.ok(personalCopy.channelNames[id].name.ru)
    const text = JSON.stringify(personalCopy)
    assert.ok(!/[–—]/.test(text))
    assert.ok(!/конструктор|калькулятор/i.test(text))
    // Telegram is one channel among equals: the personal channel list has more than it and it is not forced
    assert.ok(m.personalChannels.length >= 7 && m.personalChannels.filter((c) => c === 'telegram').length === 1)
  })
})

test('personal byok: chunk key b encodes 0|1, old links decode without it, summary and brief carry it', () => {
  const base = fullPersonal()
  assert.ok(!('b' in JSON.parse(personalMod.personalJson(base.personal))))
  assert.equal(decodeBuild(encodeBuild(base)).personal.byok, undefined)
  assert.equal(personalMod.parsePersonalJson('{"w":"student","t":"plus"}').byok, undefined)
  const own = personalMod.withPersonal(base, { byok: true })
  assert.equal(JSON.parse(personalMod.personalJson(own.personal)).b, 1)
  assert.equal(decodeBuild(encodeBuild(own)).personal.byok, true)
  const ours = personalMod.withPersonal(base, { byok: false })
  assert.equal(JSON.parse(personalMod.personalJson(ours.personal)).b, 0)
  assert.equal(decodeBuild(encodeBuild(ours)).personal.byok, false)
  assert.equal(personalMod.parsePersonalJson('{"b":7}').byok, undefined)
  assert.ok(personalMod.personalJson(own.personal).length <= personalMod.personalLimit)
  assert.match(leadSummary(own, ru, 'ru', defaultPricing), /Свой ключ: да/)
  assert.match(leadSummary(base, ru, 'ru', defaultPricing), /Свой ключ: нет/)
  assert.match(leadSummary(own, en, 'en', defaultPricing), /Own key: yes/)
  assert.equal(personalMod.leadBriefOf(own).byok, true)
  assert.equal(personalMod.leadBriefOf(base).byok, false)
  const plan = defaultPricing.personalPlans.plus
  assert.equal(personalMod.monthlyOf(plan, true), plan.byokMonthly)
  assert.equal(personalMod.monthlyOf(plan, false), plan.monthly)
  assert.ok(estimateDoc(own, ru, 'ru', defaultPricing).onRequest[0].price.includes('$' + plan.byokMonthly))
})

test('personal lead never carries the business state of an earlier build', () => {
  // a business build first (cafe + lead manager), then the same visitor goes «для себя»
  let biz = withDetails(applySiteNeed(toggleProduct(presets.cafe, 'intake'), 'no'), { company: 'Кафе Рай', deadline: 'w2' })
  biz = personalMod.withDiscovery(biz, { size: 's5' })
  const asked = personalMod.startPersonal(biz)
  const mixed = personalMod.withPersonal(asked, { who: 'student', hand: ['mail', 'calendar'], where: ['telegram'], tier: 'basic' })
  // switching resets every business chunk, discovery stays
  assert.ok(!mixed.kind && !mixed.goals && !mixed.details && !Object.keys(mixed.parts).length)
  assert.deepEqual(mixed.products, ['personal'])
  assert.equal(mixed.discovery.size, 's5')
  // a link that carries both worlds (old link or a stale draft) is cleaned on decode
  const dirty = decodeBuild(encodeBuild({ ...biz, personal: mixed.personal, options: mixed.options }))
  assert.ok(!dirty.kind && !dirty.goals && !dirty.details && !Object.keys(dirty.parts).length && dirty.products.join() === 'personal')
  // even an unclean build object gives a clean lead text, brief and estimate
  const unclean = { ...biz, personal: mixed.personal, options: mixed.options }
  for (const locale of ['ru', 'en']) {
    const dict = locale === 'ru' ? ru : en
    const text = leadSummary(unclean, dict, locale, defaultPricing)
    assert.ok(!/кафе|ИИ-менеджер заявок|cafe|lead manager|Кафе Рай|Сайт|Website/i.test(text), text)
    const doc = estimateDoc(unclean, dict, locale, defaultPricing)
    assert.ok(doc.kind === null && doc.products.length === 0 && !doc.parts.length && !doc.extras.length)
    const f = leadEstimateFields(unclean, dict, locale, defaultPricing)
    assert.ok(!/кафе|cafe/i.test(f.estimate + (f.message ?? '')))
  }
  const brief = personalMod.leadBriefOf(unclean)
  assert.equal(brief.type, 'personal')
  for (const key of ['niche', 'products', 'goals', 'sources', 'delivery', 'siteNeed', 'theme', 'details']) assert.ok(!(key in brief), key)
  assert.equal(leadServiceOf(unclean), 'personal')
  assert.ok(leadSchema.safeParse({ name: 'A', contact: 'a@b.cc', service: 'personal' }).success)
  // and back to business: personal chunks are gone
  const back = personalMod.stopPersonal(mixed)
  assert.ok(!back.personal && !back.products && !back.options && back.discovery.size === 's5')
})
