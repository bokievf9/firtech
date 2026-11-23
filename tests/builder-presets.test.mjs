// Niche presets and «начать с задачи» (builder v6 wave 2): eight presets with a live price and an encodable build, the
// preset and task chunks of the link and the lead brief, and the local matcher (top-1 for 12 RU/EN phrases, a no-match case).
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

const { decodeBuild, encodeBuild, quote } = await import('../src/lib/builder.ts')
const P = await import('../src/lib/builder-presets.ts')
const { presetCopy, presetIds } = await import('../src/content/builder-presets.ts')
const { defaultPricing } = await import('../src/lib/pricing.ts')
const { leadBriefOf } = await import('../src/lib/builder-personal.ts')
const { agentQuote } = await import('../src/lib/builder-agent.ts')

test('there are eight presets with copy in both languages', () => {
  assert.deepEqual([...presetIds], ['cafe', 'salon', 'shop', 'delivery', 'services', 'clinic', 'auto', 'school'])
  for (const id of presetIds) {
    const c = presetCopy[id]
    for (const l of ['ru', 'en']) {
      assert.ok(c.name[l] && c.promise[l] && c.reason[l], `${id} ${l}`)
      assert.equal(c.inside[l].length, 3)
      assert.doesNotMatch(JSON.stringify([c.name[l], c.promise[l], c.inside[l], c.reason[l]]), /[–—]|\$\d/)
    }
  }
})

test('every preset is a priced build that survives the link', () => {
  for (const id of presetIds) {
    const b = P.presetBuild(id)
    assert.equal(b.preset, id)
    assert.ok(b.agents?.length, `${id} agents`)
    const price = P.presetPrice(id, defaultPricing)
    assert.ok(price.oneTime > 0, `${id} one-time`)
    assert.equal(price.oneTime, quote(b, defaultPricing).total + agentQuote(b, defaultPricing).oneTime)
    const back = decodeBuild(encodeBuild(b))
    assert.equal(back.preset, id)
    assert.deepEqual(back.agents, b.agents)
    assert.deepEqual(back.parts, b.parts)
    assert.deepEqual(back.products, b.products)
    assert.equal(encodeBuild(back), encodeBuild(b))
  }
})

test('the preset price follows the live pricing', () => {
  const doubled = structuredClone(defaultPricing)
  for (const slug of Object.keys(doubled.catalog)) {
    const c = doubled.catalog[slug]
    for (const k of Object.keys(c.variants)) c.variants[k] *= 2
  }
  assert.ok(P.presetPrice('salon', doubled).oneTime > P.presetPrice('salon', defaultPricing).oneTime)
})

test('the task and the preset ride in the lead brief, sanitized and capped', () => {
  const task = 'Салон  красоты\n\u0007 нужна запись'
  const b = P.presetBuild('salon', { task })
  const back = decodeBuild(encodeBuild({ ...b, task: 'x'.repeat(900) }))
  assert.equal(back.task.length, 300)
  const brief = leadBriefOf(decodeBuild(encodeBuild({ ...b, task: 'Салон  красоты\n нужна запись' })))
  assert.equal(brief.preset, 'salon')
  assert.equal(brief.task, 'Салон красоты нужна запись')
  assert.equal(brief.type, 'business')
  // old links and unknown ids stay harmless
  assert.equal(decodeBuild('r.BAD!~websites.landing').preset, undefined)
})

const cases = [
  ['У меня салон красоты, клиенты звонят за записью, не успеваю отвечать', 'preset', 'salon'],
  ['Хочу бота для барбершопа: запись и напоминания', 'preset', 'salon'],
  ['Мы кафе, нужна бронь столов и актуальное меню', 'preset', 'cafe'],
  ['Интернет-магазин одежды, нужен каталог и заказы', 'preset', 'shop'],
  ['Доставка суши, заказы теряются в чатах', 'preset', 'delivery'],
  ['Стоматология, пациенты забывают о приёме', 'preset', 'clinic'],
  ['Автосервис, хочу записывать на ТО и напоминать клиентам', 'preset', 'auto'],
  ['Онлайн-школа английского, нужны ответы ученикам', 'preset', 'school'],
  ['I run a beauty salon and need online booking reminders', 'preset', 'salon'],
  ['We are a restaurant and want table booking in Telegram', 'preset', 'cafe'],
  ['Car service garage: bookings and maintenance reminders', 'preset', 'auto'],
  ['Каждую неделю вручную собираю отчёты из таблиц, хочу автоматизировать рутину', 'need', 'automation'],
  ['Need posts and content for Instagram every week', 'need', 'content'],
]

for (const [text, kind, id] of cases) {
  test(`matcher: ${text.slice(0, 50)}`, () => {
    const m = P.matchPreset(text)
    assert.ok(m, 'a match')
    assert.equal(m.kind, kind)
    assert.equal(m.id, id)
    assert.ok(m.reason.ru && m.reason.en)
    const b = P.matchBuild(m, text)
    assert.ok(Object.keys(b.parts).length > 0 || m.id === 'content')
    assert.equal(b.task, text)
  })
}

test('matcher: nothing to go on gives null', () => {
  for (const t of ['', 'ну', 'привет как дела', 'asdf qwer zxcv', 'hello there']) assert.equal(P.matchPreset(t), null, t)
})

test('matcher: «автоматизация» is not a car service and the reason reads naturally', () => {
  assert.equal(P.matchPreset('хочу автоматизацию')?.id, 'automation')
  assert.match(P.matchPreset('салон красоты')?.reason.ru, /^салон красоты: запись и напоминания$/)
})

test('a personal task points at the personal path', () => {
  const m = P.matchPreset('нужен личный ассистент: почта и календарь')
  assert.ok(m && P.isPersonalMatch(m))
})

test('Fira in the builder: the window bridge drives the shared store (think, say, fail, only-if-idle)', async () => {
  const { createFiraStore, applyFiraSay } = await import('../src/lib/fira/live.ts')
  const store = createFiraStore({ reduced: () => true })
  applyFiraSay(store, { op: 'think' })
  assert.equal(store.getSnapshot().state, 'thinking')
  applyFiraSay(store, { op: 'fail' })
  assert.equal(store.getSnapshot().state, 'sorry')
  assert.equal(store.getSnapshot().bubble, null)
  applyFiraSay(store, { op: 'say', text: 'Похоже на салон', ifIdle: true })
  await new Promise((r) => setTimeout(r, 30))
  // she was not idle (sorry): the offer line stays quiet
  assert.equal(store.getSnapshot().bubble, null)
  applyFiraSay(store, { op: 'say', text: 'Похоже на салон' })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(store.getSnapshot().bubble?.text, 'Похоже на салон')
  store.destroy()
})
