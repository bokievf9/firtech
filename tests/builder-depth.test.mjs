// Builder depth (2026-11-24): more chips and a free note in the discovery («Детали» / «О вас»), department questions on the
// agent path. Link roundtrip with the new keys and the note, the sanitizer, the size limits (`?b=` under 2 KB), the lead
// brief, the compact summary count, and the copy of every id.
import assert from 'node:assert/strict'
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


const { default: ru } = await import('../src/content/ru.ts')
const { decodeBuild, encodeBuild, emptyBuild } = await import('../src/lib/builder.ts')
const A = await import('../src/lib/builder-agent.ts')
const D = await import('../src/lib/builder-depth.ts')
const P = await import('../src/lib/builder-personal.ts')
const ids = await import('../src/lib/builder-ids.ts')
const copy = await import('../src/content/builder-personal.ts')
const depthCopy = await import('../src/content/builder-depth.ts')
const { estimateDoc } = await import('../src/lib/estimate-doc.ts')
const { defaultPricing } = await import('../src/lib/pricing.ts')

const rich = () => {
  const b = P.withDiscovery(emptyBuild, {
    size: 's10', leads: 'd100', base: 'k5k', hours: 'hweekend', approver: 'partners', pains: ['calls', 'other'], success: ['speed'],
    src: ['instagram', 'friends'], tools: ['amocrm', 'sheets'], langs: ['ru', 'tj'], when: 'quarter', note: 'Хочу, чтобы всё работало в Telegram',
  })
  return b
}

test('discovery: new keys and the note survive the link', () => {
  const b = rich()
  const back = decodeBuild(encodeBuild(b))
  assert.deepEqual(back.discovery, b.discovery)
  const personal = P.withDiscovery(P.startPersonal(emptyBuild), { role: 'freelance', rhythm: ['owl', 'travel'], chan: ['telegram', 'email'], langs: ['en'], first: 'mail', dev: ['iphone', 'mac'], note: 'Много поездок' })
  assert.deepEqual(decodeBuild(encodeBuild(personal)).discovery, personal.discovery)
})

test('discovery: unknown ids are dropped, old links decode', () => {
  const json = JSON.stringify({ sz: 'solo', sc: ['instagram', 'zzz'], tl: ['nope'], wn: 'never', fi: 'mail', no: 'ok' })
  assert.deepEqual(P.parseDiscoveryJson(json), { size: 'solo', src: ['instagram'], first: 'mail', note: 'ok' })
  // the legacy ids of the old lists are still known
  assert.equal(P.parseDiscoveryJson(JSON.stringify({ sz: 's20p', ld: 'd50p' })).size, 's20p')
})

test('note sanitizer: control characters, angle brackets, spaces, length', () => {
  assert.equal(P.cleanNote('  a\u0000b\n\tc   <script>x</script> '), 'a b c script x /script')
  assert.equal(P.cleanNote('я'.repeat(900)).length, P.noteLimit)
  assert.equal(P.cleanNote('<>'), '')
  assert.equal(P.typingNote('ab '), 'ab ')
  assert.ok(!/[<>]/.test(P.typingNote('x<b>y')))
  const back = P.parseDiscoveryJson(P.discoveryJson({ note: '  <b>hi</b>  ' }))
  assert.equal(back.note, 'b hi /b')
})

test('size limits: a 500-character Cyrillic note keeps the link under 2 KB, both paths', () => {
  const longNote = 'ё'.repeat(500)
  const full = P.withDiscovery(emptyBuild, {
    size: 's50p', leads: 'd100p', base: 'k10kp', hours: 'hseason', tz: 'UTC+5', approver: 'client', site: 'https://example.com/very/long/path', instagram: '@name',
    pains: [...ids.discPains], success: [...ids.discSuccess], heard: 'ads', src: [...ids.discSrc], tools: [...ids.discTools], langs: [...ids.discLangs], when: 'date', note: longNote,
  })
  const json = P.discoveryJson(full.discovery)
  assert.ok(json.length <= P.discoveryLimit)
  assert.ok(new TextEncoder().encode(json).length <= P.discoveryBytes)
  const business = { ...full, kind: 'salon', goals: ['bookings'], channels: ['telegram'] }
  assert.ok(encodeBuild(business).length < 2048, `business link ${encodeBuild(business).length}`)
  // the note is shortened, never dropped, when it does not fit
  assert.ok(decodeBuild(encodeBuild(business)).discovery.note.length > 100)
  let agent = A.startAgent(emptyBuild, 'lead-handler')
  agent = A.withAgentBrief(agent, { channels: ['telegram', 'web', 'whatsapp', 'voice', 'email'], connect: ['crm', 'calendar'], volume: 'm', knowledge: true, training: true, note: longNote })
  for (const q of D.depthQuestions.sales) agent = A.withDeep(agent, q.id, q.single ? [q.options[0]] : [...q.options])
  agent = P.withDiscovery(agent, { note: longNote, pains: [...ids.discPains] })
  const href = encodeBuild(agent)
  assert.ok(href.length < 2048, `agent link ${href.length}`)
  assert.ok(decodeBuild(href).agentBrief.note.length > 100)
})

test('agent depth: roundtrip, single answers, unknown questions and options dropped', () => {
  let b = A.startAgent(emptyBuild, 'lead-handler')
  b = A.withAgentBrief(b, { channels: ['telegram'], volume: 's' })
  b = A.withDeep(b, 'sl-src', ['instagram', 'ads'])
  b = A.withDeep(b, 'sl-resp', ['m5', 'h1'])
  b = A.withAgentBrief(b, { note: 'Отвечать коротко' })
  const back = decodeBuild(encodeBuild(b))
  assert.deepEqual(back.agentBrief.deep, { 'sl-src': ['instagram', 'ads'], 'sl-resp': ['m5'] })
  assert.equal(back.agentBrief.note, 'Отвечать коротко')
  assert.deepEqual(D.cleanDeep({ 'sl-resp': ['m5', 'h1'], 'zz-q': ['a'], 'sl-src': ['nope', 'ads'] }), { 'sl-resp': ['m5'], 'sl-src': ['ads'] })
  // clearing the last pick removes the question
  const cleared = A.withDeep(b, 'sl-src', [])
  assert.ok(!('sl-src' in cleared.agentBrief.deep))
  // a link without the e. chunk decodes as before
  assert.ok(!decodeBuild(encodeBuild(A.startAgent(emptyBuild, 'lead-handler'))).agentBrief.deep)
})

test('lead brief and estimate rows carry the depth, the note and the discovery note', () => {
  let b = A.withAgentBrief(A.startAgent(emptyBuild, 'lead-handler'), { channels: ['telegram'], volume: 'm', note: 'Тон дружелюбный' })
  b = A.withDeep(b, 'sl-crm', ['amocrm'])
  b = P.withDiscovery(b, { note: 'Заметка про компанию' })
  const brief = P.leadBriefOf(b)
  assert.deepEqual(brief.depth, { 'sl-crm': ['amocrm'] })
  assert.equal(brief.note, 'Тон дружелюбный')
  assert.equal(brief.discovery.note, 'Заметка про компанию')
  assert.ok(JSON.stringify(brief).length <= P.leadBriefLimit)
  const doc = estimateDoc(b, ru, 'ru', defaultPricing)
  assert.ok(doc.brief.setup.some((r) => r.id === 'a-d-sl-crm' && r.value === 'amoCRM'))
  assert.ok(doc.brief.setup.some((r) => r.id === 'a-d-note'))
  const biz = estimateDoc(P.withDiscovery(emptyBuild, { src: ['telegram'], note: 'Привет' }), ru, 'ru', defaultPricing)
  assert.ok(biz.brief.details.some((r) => r.id === 'd-src'))
  assert.ok(biz.brief.details.some((r) => r.id === 'd-note' && r.value === 'Привет'))
})

test('compact count: answers and the note', () => {
  assert.deepEqual(P.discoveryCount(rich().discovery), { answers: 11, note: true })
  assert.deepEqual(P.discoveryCount(undefined), { answers: 0, note: false })
  assert.equal(copy.detailsSummary.answers(7, true), '7 ответов')
  assert.equal(copy.detailsSummary.answers(2, true), '2 ответа')
  assert.equal(copy.detailsSummary.answers(21, true), '21 ответ')
  assert.equal(copy.detailsSummary.answers(1, false), '1 answer')
})

test('chips: 6 to 8 per business and personal question, every id has RU and EN copy, no dashes', () => {
  const lists = [
    [ids.discSizesShown, copy.sizeText], [ids.discLeadsShown, copy.leadsText], [ids.discBaseShown, copy.baseText],
    [ids.discHours, copy.hoursText], [ids.discApprover, copy.approverText], [ids.discSrc, copy.srcText],
    [ids.discTools, copy.discToolText], [ids.discLangs, copy.langText], [ids.discWhen, copy.whenText], [ids.discRole, copy.roleText],
    [ids.discRhythm, copy.rhythmText], [ids.discChan, copy.chanText], [ids.discDev, copy.devText],
  ]
  for (const [list, labels] of lists) {
    assert.ok(list.length >= 6 && list.length <= 8, `${list.join()} has ${list.length}`)
    for (const id of [...list]) {
      for (const loc of ['ru', 'en']) assert.ok(labels[id]?.[loc], `${id} ${loc}`)
    }
  }
  for (const list of [ids.discSizes, ids.discLeads, ids.discBase]) for (const id of list) assert.ok({ ...copy.sizeText, ...copy.leadsText, ...copy.baseText }[id])
  const text = JSON.stringify([copy.srcText, copy.discToolText, copy.langText, copy.whenText, copy.roleText, copy.rhythmText, copy.chanText, copy.devText, copy.discUi, depthCopy.depthUi, depthCopy.depthTitle])
  assert.ok(!/[\u2013\u2014]/.test(text), 'no em or en dashes')
})

test('depth copy: every question has a title and every option has RU and EN, 4 to 8 chips', () => {
  for (const [dept, questions] of Object.entries(D.depthQuestions)) {
    assert.ok(questions.length >= 3, dept)
    for (const q of questions) {
      assert.ok(depthCopy.depthTitle[q.id]?.ru && depthCopy.depthTitle[q.id]?.en, q.id)
      assert.ok(q.options.length >= 4 && q.options.length <= 8, `${q.id} ${q.options.length}`)
      for (const id of q.options) {
        const label = depthCopy.depthLabel(q.id, id)
        assert.ok(label.ru && label.en, `${q.id}.${id}`)
        assert.notEqual(label.ru, id, `${q.id}.${id} has no Russian label`)
      }
    }
  }
  assert.ok(!/[\u2013\u2014]/.test(JSON.stringify([depthCopy.depthTitle, depthCopy.depthUi])))
  assert.equal(new Set(Object.values(D.depthQuestions).flat().map((q) => q.id)).size, Object.values(D.depthQuestions).flat().length)
  assert.equal(A.agentStepCount, 7)
})

test('agent path: depth answers do not touch the paid options or the price', () => {
  let b = A.withAgentBrief(A.startAgent(emptyBuild, 'lead-handler'), { channels: ['telegram'], volume: 'm', knowledge: true })
  const before = A.agentQuote(b, defaultPricing).oneTime
  assert.equal(before, defaultPricing.agentAddons.knowledge + A.agentQuote(A.startAgent(emptyBuild, 'lead-handler'), defaultPricing).setup)
  b = A.withDeep(b, 'sl-src', ['instagram'])
  b = A.withAgentBrief(b, { note: 'x' })
  assert.equal(b.agentBrief.knowledge, true)
  assert.equal(A.agentQuote(b, defaultPricing).oneTime, before)
  const back = decodeBuild(encodeBuild(b))
  assert.equal(back.agentBrief.knowledge, true)
  assert.equal(A.agentQuote(back, defaultPricing).oneTime, before)
})
