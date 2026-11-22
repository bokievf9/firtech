import assert from 'node:assert/strict'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { kindCatalog, kindIds } from '../src/content/builder-catalog.ts'
import * as C from '../src/content/capabilities.ts'
import { whoTextAll, connectText, toneUi } from '../src/content/builder-personal.ts'
import { personalConnect, personalWhoAll, toneAxes } from '../src/lib/builder-ids.ts'
import { decodeBuild, encodeBuild, presets } from '../src/lib/builder.ts'
import * as K from '../src/lib/builder-capabilities.ts'
import { leadBriefOf, leadBriefLimit, personalLimit, personalJson, parsePersonalJson, withPersonal, startPersonal } from '../src/lib/builder-personal.ts'
import { briefOf, leadLimit, leadSummary } from '../src/lib/estimate-doc.ts'

const unique = (list) => new Set(list).size === list.length
const bothLangs = (items, label) => {
  for (const i of items) {
    for (const lang of ['ru', 'en']) {
      assert.ok(i.name[lang]?.trim(), `${label} ${i.id} name ${lang}`)
      assert.ok(i.hint[lang]?.trim(), `${label} ${i.id} hint ${lang}`)
      assert.ok(!/[–—]/.test(i.name[lang] + i.hint[lang]), `${label} ${i.id} has a dash`)
    }
  }
}

// ---------------------------------------------------------------- integrity

test('catalogue: counts reach the targets', () => {
  assert.equal(kindIds.length, 56)
  for (const kind of kindIds) {
    const n = C.subNiches[kind].length
    assert.ok(n >= 2 && n <= 5, `${kind} sub-niches ${n}`)
    assert.equal(kindCatalog[kind].ru[3].length, 3, `${kind} pains`)
    assert.equal(K.nichePains(kind, 'en').length, 3)
  }
  assert.ok(C.results.length >= 40, `results ${C.results.length}`)
  assert.ok(C.capabilities.length >= 120, `capabilities ${C.capabilities.length}`)
  assert.equal(C.capabilityGroups.length, 14)
  assert.equal(C.channelGroups.length, 7)
  assert.ok(C.integrations.length >= 40, `integrations ${C.integrations.length}`)
  assert.ok(C.contentFormats.length >= 8 && C.contentFrequencies.length === 5)
  assert.ok(C.personalSkills.length >= 40, `skills ${C.personalSkills.length}`)
  assert.equal(personalWhoAll.length, 15)
  assert.equal(personalConnect.length, 25)
  assert.equal(toneAxes, 5)
  assert.equal(toneUi.axes.length, 5)
})

test('catalogue: ids unique, both languages, no dashes, groups non-empty, sub-options belong to a group', () => {
  const lists = {
    results: [C.results, C.resultGroups],
    capabilities: [C.capabilities, C.capabilityGroups],
    channelOptions: [C.channelOptions, C.channelGroups],
    integrations: [C.integrations, C.integrationGroups],
    skills: [C.personalSkills, C.skillGroups],
  }
  for (const [label, [items, groups]] of Object.entries(lists)) {
    assert.ok(unique(items.map((i) => i.id)), `${label} ids unique`)
    bothLangs(items, label)
    for (const g of groups) {
      assert.ok(g.name.ru && g.name.en, `${label} group ${g.id}`)
      assert.ok(items.some((i) => i.group === g.id), `${label} group ${g.id} is empty`)
    }
    for (const i of items) assert.ok(groups.some((g) => g.id === i.group), `${label} ${i.id} group`)
    for (const id of items.map((i) => i.id)) assert.ok(!/[.~\-]/.test(id), `${id} has a link separator`)
  }
  for (const c of C.capabilities) assert.ok(c.by.length > 0 && c.by.every(Boolean), `${c.id} providers`)
  assert.ok(unique(C.allSubNicheIds))
  for (const kind of kindIds) for (const s of C.subNiches[kind]) assert.ok(s.name.ru && s.name.en)
  // channel sub-options: 3-5 per channel
  for (const g of C.channelGroups) {
    const n = C.channelOptions.filter((i) => i.group === g.id).length
    assert.ok(n >= 3 && n <= 5, `${g.id} ${n}`)
  }
  // the named integrations of the brief are there
  const ids = C.integrations.map((i) => i.id)
  for (const need of ['amocrm', 'bitrix24', 'hubspot', 'yclients', 'gsheets', 'gcalendar', 'outlook', 'onec', 'kaspi', 'payme', 'click', 'stripe', 'yandexmaps', '2gis', 'googlemaps', 'instagram', 'facebook', 'telegram', 'whatsapp', 'notion', 'moodle'])
    assert.ok(ids.includes(need), need)
  for (const id of ['telegram', 'whatsapp', 'widget', 'voice', 'email', 'miniapp', 'desktop']) assert.ok(C.channelGroups.some((g) => g.id === id))
})

test('personal: personas, connections, five axes have texts in both languages', () => {
  for (const id of personalWhoAll) assert.ok(whoTextAll[id].name.ru && whoTextAll[id].name.en && whoTextAll[id].hint.en, id)
  for (const id of personalConnect) assert.ok(connectText[id].ru && connectText[id].en, id)
  for (const id of personalConnect) assert.ok(C.connectionGroups.some((g) => g.id === C.connectionGroupOf[id]), `${id} group`)
  for (const axis of toneUi.axes) assert.equal(axis.options.length, 3)
})

// ------------------------------------------------------------------ the chunk

const sample = () => ({
  parts: {},
  extras: ['seo'],
  kind: 'salon',
  products: ['adminbot'],
  catalog: { sub: ['salon1', 'salon3'], res: ['rs01', 'rs11'], cap: ['bk01', 'in01', 'py01', 'dc01'], chn: ['ch01', 'ch10'], int: ['yclients', 'kaspi'], con: { f01: 'q3', f02: 'q1' } },
})

test('x chunk: round trip, shares the letter with the extras list, old links still decode', () => {
  const link = encodeBuild(sample())
  const chunks = link.split('~')
  assert.ok(chunks.includes('x.seo'), 'extras chunk kept')
  assert.equal(chunks.filter((c) => c.startsWith('x.ey')).length, 1)
  const back = decodeBuild(link)
  assert.deepEqual(back.extras, ['seo'])
  assert.deepEqual(back.catalog, sample().catalog)
  // an old link with extras only
  assert.deepEqual(decodeBuild('websites.landing~x.seo-support').extras, ['seo', 'support'])
  assert.equal(decodeBuild('websites.landing~x.seo-support').catalog, undefined)
  // every starting set decodes without a catalogue
  for (const id of kindIds) assert.equal(decodeBuild(encodeBuild(presets[id])).catalog, undefined, id)
})

test('x chunk: unknown ids and broken JSON are dropped, bounded length', () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const parsed = decodeBuild(`websites.landing~x.${b64({ rs: ['rs01', 'nope'], cp: ['zz99'], ct: { f01: 'q3', f99: 'q1', f02: 'bad' } })}`)
  assert.deepEqual(parsed.catalog, { res: ['rs01'], con: { f01: 'q3' } })
  assert.equal(decodeBuild('websites.landing~x.eyJ0Ijo').catalog, undefined)
  const all = {
    sub: C.subNiches.salon.map((s) => s.id),
    res: C.results.map((r) => r.id),
    cap: C.capabilities.map((c) => c.id),
    chn: C.channelOptions.map((c) => c.id),
    int: C.integrations.map((i) => i.id),
    con: Object.fromEntries(C.contentFormats.map((f) => [f.id, 'q1'])),
    skl: C.personalSkills.map((s) => s.id),
  }
  const json = K.catalogJson(all)
  assert.ok(json.length > 0 && json.length <= K.catalogLimit, `json ${json.length}`)
  const link = encodeBuild({ parts: {}, extras: [], kind: 'salon', catalog: all })
  assert.ok(link.length < 2400, `link ${link.length}`)
  assert.ok(decodeBuild(link).catalog.cap.length > 20)
  assert.equal(K.catalogJson({}), '')
})

test('kind change drops sub-niches of the old kind', () => {
  const b = K.keepSubNiches({ ...sample(), kind: 'clinic' })
  assert.equal(b.catalog.sub, undefined)
  assert.deepEqual(b.catalog.cap, sample().catalog.cap)
})

// -------------------------------------------------- summary, coverage, brief

test('scope: capabilities of the picked products are in the set, the rest «по смете»', () => {
  const b = { ...sample(), catalog: { cap: ['bk01', 'dc01', 'sm01'] } }
  const s = K.capabilityScope(b)
  assert.deepEqual(s.covered, ['bk01'])
  assert.deepEqual(s.quote, ['dc01', 'sm01'])
  const rows = K.catalogRows(b, 'ru')
  assert.ok(rows.find((r) => r.id === 'c-quote').value.includes('Договор по шаблону'))
  assert.ok(!rows.some((r) => /\$|USD|\d+\s*₽/.test(r.value)), 'no price in rows')
})

test('summary rows: grouped, bounded, «+N ещё» when long', () => {
  const b = { ...sample(), catalog: { cap: C.capabilities.map((c) => c.id), int: C.integrations.map((i) => i.id) } }
  for (const locale of ['ru', 'en']) {
    for (const r of K.catalogRows(b, locale)) assert.ok(r.value.length <= K.rowLimit + 24, `${r.id} ${r.value.length}`)
    const cap = K.catalogRows(b, locale).find((r) => r.id === 'c-cap').value
    assert.ok(cap.includes(locale === 'ru' ? 'ещё)' : 'more)'))
  }
  const small = K.catalogRows({ ...sample(), catalog: { cap: ['in01', 'bk01'] } }, 'ru').find((r) => r.id === 'c-cap').value
  assert.equal(small, 'Приём заявок: Ответ на первое сообщение за секунды; Запись и календарь: Запись на услугу в чате')
})

test('leadSummary stays within the limit with everything picked, catalogue rows come when there is room', () => {
  const all = {
    sub: ['salon1'], res: C.results.slice(0, 20).map((r) => r.id), cap: C.capabilities.map((c) => c.id),
    chn: C.channelOptions.map((c) => c.id), int: C.integrations.map((i) => i.id), con: { f01: 'q3' },
  }
  const b = { ...sample(), catalog: all }
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    const text = leadSummary(b, dict, locale)
    assert.ok(text.length <= leadLimit, `${locale} ${text.length}`)
  }
  const light = leadSummary({ ...sample(), catalog: { cap: ['in01'] } }, ru, 'ru')
  assert.ok(light.includes('Возможности агента'))
  assert.ok(briefOf(b, ru, 'ru').catalog.length >= 5)
})

test('brief.capabilities for HQ: ids only, quote flag, fits the limit', () => {
  const b = { ...sample(), catalog: { ...sample().catalog, cap: ['bk01', 'sm01'] } }
  const brief = leadBriefOf(b)
  assert.deepEqual(brief.capabilities.abilities, ['bk01', 'sm01'])
  assert.deepEqual(brief.capabilities.quote, ['sm01'])
  assert.deepEqual(brief.capabilities.subniche, ['salon1', 'salon3'])
  assert.deepEqual(brief.capabilities.content, { f01: 'q3', f02: 'q1' })
  const many = { ...sample(), catalog: { cap: C.capabilities.map((c) => c.id), int: C.integrations.map((i) => i.id), res: C.results.map((r) => r.id) }, goals: ['leads'] }
  const big = leadBriefOf(many)
  assert.ok(JSON.stringify(big).length <= leadBriefLimit)
  assert.equal(leadBriefOf({ parts: {}, extras: [] }), null)
})

test('personal: new personas and connections ride in `m.`, five axes, old three-value links read', () => {
  let b = startPersonal({ parts: {}, extras: [] })
  b = withPersonal(b, {
    who: 'athlete',
    hand: ['mail', 'health'],
    where: ['web'].map(() => 'telegram'),
    connect: [...personalConnect],
    tone: [2, 0, 1, 2, 0],
    tier: 'plus',
  })
  b.catalog = { skl: ['sk01', 'sk19', 'sk45'] }
  const json = personalJson(b.personal)
  assert.ok(json.length <= personalLimit)
  const back = decodeBuild(encodeBuild(b))
  assert.equal(back.personal.who, 'athlete')
  assert.equal(back.personal.connect.length, 25)
  assert.deepEqual(back.personal.tone, [2, 0, 1, 2, 0])
  assert.deepEqual(back.catalog.skl, ['sk01', 'sk19', 'sk45'])
  assert.deepEqual(parsePersonalJson('{"n":[2,0,1]}').tone, [2, 0, 1, 1, 1])
  assert.equal(parsePersonalJson('{"w":"nobody"}').who, undefined)
  const brief = leadBriefOf(back)
  assert.equal(brief.tone.humor, 2)
  assert.deepEqual(brief.capabilities.skills, ['sk01', 'sk19', 'sk45'])
  const rows = briefOf(back, ru, 'ru')
  assert.ok(rows.catalog.some((r) => r.id === 'c-skl'))
})
