// Client onboarding after a lead (2026-11-24): the journey parse and fallback, the stage copy, the stepper,
// the success screen copy, the first-visit tour (once per account), «основатель» gone from the cabinet.
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

const j = await import('../src/lib/cabinet-journey.ts')
const data = await import('../src/lib/cabinet-data.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')

test('journey: a full HQ payload is parsed, texts and channels kept', () => {
  const v = j.parseJourney({
    stage: 'quote',
    since: '2026-11-24T09:00:00Z',
    eta: '2026-11-25T09:00:00Z',
    etaText: { ru: 'до завтра', en: 'by tomorrow' },
    clientAction: { kind: 'accept_quote', href: '/cabinet?tab=documents&doc=q-1', label: { ru: 'Принять КП' } },
    answersWhere: ['cabinet', 'email', 'telegram'],
    nextWeWill: { ru: 'Готовим КП' },
  })
  assert.equal(v.stage, 'quote')
  assert.equal(v.etaText.en, 'by tomorrow')
  assert.deepEqual(v.clientAction, { kind: 'accept_quote', href: '/cabinet?tab=documents&doc=q-1', label: { ru: 'Принять КП', en: 'Принять КП' } })
  assert.deepEqual(v.answersWhere, ['cabinet', 'email', 'telegram'])
  assert.equal(j.pickText(v.nextWeWill, 'en'), 'Готовим КП', 'a missing language falls back to the other one')
})

test('journey: HQ links have no locale, the site adds it; pay links and localized paths stay; stageOf is read', () => {
  assert.equal(j.localizeHref('/cabinet?tab=messages', 'en'), '/en/cabinet?tab=messages')
  assert.equal(j.localizeHref('/ru/cabinet', 'ru'), '/ru/cabinet')
  assert.equal(j.localizeHref('https://pay.example/i/1', 'ru'), 'https://pay.example/i/1')
  assert.deepEqual(j.parseJourney({ stage: 'stages', stageOf: { no: 2, total: 3 } }).stageOf, { no: 2, total: 3 })
  assert.equal(j.parseJourney({ stage: 'stages', stageOf: { no: 4, total: 3 } }).stageOf, null)
  const closed = j.parseJourney({ stage: 'invoice', clientAction: { kind: 'none' }, etaText: { ru: 'Оплату откроем после регистрации юрлица', en: 'Payment opens after the entity is registered' } })
  assert.equal(closed.clientAction.kind, 'none')
})

test('journey: tolerant, a bad field is dropped, an unknown stage or junk is no journey, links are safe', () => {
  assert.equal(j.parseJourney(null), null)
  assert.equal(j.parseJourney('quote'), null)
  assert.equal(j.parseJourney({ stage: 'weird' }), null)
  const v = j.parseJourney({ stage: 'contract', since: 'yesterday', eta: 5, etaText: 'x', clientAction: { kind: 'hack', href: 'javascript:alert(1)' }, answersWhere: 'cabinet', nextWeWill: { ru: 7 } })
  assert.equal(v.stage, 'contract')
  assert.equal(v.since, null)
  assert.equal(v.eta, null)
  assert.equal(v.etaText, null)
  assert.deepEqual(v.clientAction, { kind: 'none', href: null, label: null })
  assert.deepEqual(v.answersWhere, [])
  assert.equal(v.nextWeWill, null)
  assert.equal(j.parseJourney({ stage: 'pay', clientAction: { kind: 'pay', href: '//evil.example' } }), null)
  assert.equal(j.parseJourney({ stage: 'invoice', clientAction: { kind: 'pay', href: '//evil.example' } }).clientAction.href, null)
  assert.equal(j.parseJourney({ stage: 'invoice', clientAction: { kind: 'pay', href: 'https://pay.example/x' } }).clientAction.href, 'https://pay.example/x')
})

test('journey: leads and projects carry it, an old payload derives it from the stage', () => {
  const [lead] = data.parseLeads([{ id: 5, stage: 'proposal', journey: { stage: 'quote', answersWhere: ['email'] } }])
  assert.equal(lead.journey.stage, 'quote')
  const [old] = data.parseLeads([{ id: 6, stage: 'qualified', nextStep: 'Из HQ' }])
  assert.equal(old.journey, null)
  assert.equal(j.journeyOf(old).stage, 'reviewing')
  const stages = { new: 'received', qualified: 'reviewing', proposal: 'quote', contract: 'contract', paid: 'paid', project: 'stages', lost: 'lost', unknown: 'received' }
  for (const [from, to] of Object.entries(stages)) assert.equal(j.deriveJourney(from).stage, to, from)
  assert.equal(j.deriveJourney('contract', 'pay_stage').stage, 'invoice')
  assert.equal(j.journeyOf({ stage: 'new', journey: j.parseJourney({ stage: 'start' }) }).stage, 'start')
  const body = data.parseClientBody({ ok: true, client: { id: 1, email: 'a@b.co' }, projects: [{ id: 3, journey: { stage: 'stages' } }, { id: 4 }] })
  assert.equal(body.projects[0].journey.stage, 'stages')
  assert.equal(body.projects[1].journey, null)
})

test('stepper: nine stages collapse to six steps, done ticks all, lost greys all', () => {
  assert.deepEqual(j.journeySteps, ['received', 'reviewing', 'quote', 'contract', 'pay', 'work'])
  const states = (stage) => j.journeyTrack(stage).steps.map((s) => s.state).join(',')
  assert.equal(states('received'), 'now,next,next,next,next,next')
  assert.equal(states('quote'), 'done,done,now,next,next,next')
  assert.equal(states('invoice'), 'done,done,done,done,now,next')
  assert.equal(states('paid'), 'done,done,done,done,now,next')
  assert.equal(states('start'), 'done,done,done,done,done,now')
  assert.equal(states('stages'), 'done,done,done,done,done,now')
  assert.equal(states('done'), 'done,done,done,done,done,done')
  assert.equal(states('lost'), 'next,next,next,next,next,next')
  assert.equal(j.journeyTrack('lost').lost, true)
  assert.deepEqual(j.answerChannels([]), ['cabinet', 'email'])
  assert.deepEqual(j.answerChannels(['telegram', 'telegram', 'pigeon']), ['telegram'])
})

test('copy: every stage has its text in RU and EN, the contract wording is there, no «основатель» in the cabinet', () => {
  for (const [locale, d] of [['ru', ru], ['en', en]]) {
    for (const stage of j.journeyStages) {
      const c = d.cabinet.journey.stages[stage]
      assert.ok(c.headline && c.now, `${locale} ${stage}`)
    }
    for (const step of j.journeySteps) assert.ok(d.cabinet.journey.steps[step], `${locale} step ${step}`)
    assert.equal(d.cabinet.journey.stages.invoice.wait.length > 20, true)
    assert.equal(d.contact.sent.steps.length, 3)
    for (const step of d.contact.sent.steps) assert.ok(step.t && step.eta)
    assert.doesNotMatch(JSON.stringify(d.cabinet), /основател|founder/i, `${locale} cabinet`)
    assert.doesNotMatch(JSON.stringify([d.contact.sent, d.contact.successText]), /основател|founder/i, `${locale} success`)
  }
  assert.match(ru.cabinet.journey.stages.reviewing.eta, /До 1 рабочего дня, обычно быстрее/)
  assert.match(ru.cabinet.journey.stages.invoice.wait, /после регистрации юрлица/)
  assert.match(ru.cabinet.journey.stages.start.headline, /3 рабочих дня/)
  assert.match(ru.cabinet.journey.stages.stages.now, /7 дней/)
  assert.equal(ru.cabinet.journey.nothing, 'Ничего, ждём нас')
  assert.equal(ru.cabinet.journey.nowTitle, 'Сейчас мы…')
  assert.match(ru.contact.sent.answer, /кабинет и на почту \{email\}/)
  assert.equal(ru.contact.sent.open, 'Открыть кабинет')
  assert.equal(ru.contact.sent.stay, 'Остаться')
  // The lead card's default sentences carry the stage copy.
  assert.match(data.leadNextStep({ stage: 'qualified', nextStep: '' }, ru.cabinet.leads.defaultNext), /до 1 рабочего дня/)
})

test('tour: shown once per account, storage failures never throw, accounts are separate', () => {
  const mem = new Map()
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) }
  assert.deepEqual(j.tourSteps, ['projects', 'documents', 'messages'])
  assert.equal(j.tourSeen(store, 'u1'), false)
  j.markTourSeen(store, 'u1')
  assert.equal(j.tourSeen(store, 'u1'), true)
  assert.equal(j.tourSeen(store, 'u2'), false)
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(j.tourSeen(broken, 'u1'), false)
  assert.doesNotThrow(() => j.markTourSeen(broken, 'u1'))
  assert.doesNotThrow(() => j.markTourSeen(null, 'u1'))
  assert.equal(j.tourSeen(null, 'u1'), false)
  assert.equal(j.tourKey('0000-aa/../x'), 'fir-cabinet-tour:0000-aa..x'.replace('..', ''), 'only safe characters reach the key')
})

test('wiring: the tour is on the cabinet page, the success screen and the 6 s redirect are in the builder send', () => {
  assert.match(readFileSync('src/app/[locale]/cabinet/page.tsx', 'utf8'), /<CabinetTour dict=\{dict\} account=\{user\.id\}/)
  const send = readFileSync('src/components/builder-send.tsx', 'utf8')
  assert.match(send, /setSecs\(6\)/)
  assert.match(send, /data-send-stay/)
  assert.match(send, /data-send-steps/)
})
