// The «Персональный ИИ» page, front v4 (owner 2026-11-22): twelve skills from the builder's own ids, eight personas, the
// channels as equals with Telegram only in the channels strip, a short page (the visible words are counted from the same
// copy the blocks render), the founder block gone, the demo locked for a signed-out visitor, `personaKind` in the chat.
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { personalHand, personalWho } = await import('../src/lib/builder-ids.ts')
const { handText, whoText } = await import('../src/content/builder-personal.ts')
const page = await import('../src/lib/personal-page.ts')
const { productPages } = await import('../src/content/product-pages.ts')
const { channelIds, channelName, channelLine } = await import('../src/lib/channels.ts')
const { chatRequestSchema } = await import('../src/lib/chat.ts')
const { decodeBuild } = await import('../src/lib/builder.ts')

const dicts = [['ru', ru], ['en', en]]
const SID = '3f2b8a52-9f4c-4c1e-8d5e-1a2b3c4d5e6f'

function* texts(value) {
  if (typeof value === 'string') yield value
  else if (Array.isArray(value)) for (const v of value) yield* texts(v)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* texts(v)
}
const words = (list) => list.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

// Everything the page shows as text, per language: the copy the blocks render, the builder's names and hints, the
// channels strip, the subscription cards' texts and the lock plate.
function visible(locale, dict) {
  const p = dict.productPage.items.personal
  const lang = locale
  const day = p.myday.personas[0]
  return {
    channels: [dict.channelsStrip.title, dict.channelsStrip.sub, ...page.personalChannelOrder.flatMap((id) => [channelName(id, lang), channelLine(id, lang)])],
    rest: [
      p.result,
      p.lead,
      p.heroCta,
      p.skills.title,
      p.skills.sub,
      p.skills.groups,
      personalHand.flatMap((id) => [handText[id].name[lang], handText[id].hint[lang]]),
      p.myday.title, p.myday.sub, p.myday.dayTitle, p.myday.demoTitle,
      page.personaKinds.map((id) => whoText[id].name[lang]),
      // one persona's day and example at a time
      day.steps, day.asks[0],
      p.plans,
      dict.productPage.planLevels,
      dict.subscription,
      p.start,
      p.questions,
      p.objections[0],
      dict.demoGate.lockTitle, dict.demoGate.lockText, dict.demoGate.login, dict.demoGate.signup, dict.demoSection.exampleBadge,
    ],
  }
}

test('skills: the twelve tiles are exactly the builder\'s hand ids, in three groups, with a line each', () => {
  assert.equal(page.isSkillSet(), true)
  assert.equal(page.allSkillIds.length, 12)
  assert.deepEqual(page.skillGroupIds.map((g) => page.skillGroups[g].length), [4, 4, 4])
  for (const [locale, dict] of dicts) {
    const s = dict.productPage.items.personal.skills
    assert.deepEqual(Object.keys(s.examples).sort(), [...personalHand].sort(), locale)
    assert.deepEqual(s.groups.map((g) => g.id), [...page.skillGroupIds], locale)
    for (const id of personalHand) {
      assert.ok(s.examples[id].length > 10 && s.examples[id].length < 70, `${locale} ${id}`)
      // the builder's own short hint under the name (at most seven words)
      assert.ok(words([handText[id].hint[locale]]) <= 7, `${locale} hint ${id}`)
    }
  }
  // every skill has an icon in the grid component
  const grid = readFileSync('src/components/product-sections/skill-grid.tsx', 'utf8')
  for (const id of personalHand) assert.match(grid, new RegExp(`\\b${id}: `), id)
})

test('personas: the eight builder kinds, a four-moment day and three questions each, skills of the day exist', () => {
  assert.deepEqual([...page.personaKinds], personalWho.filter((w) => w !== 'other'))
  assert.equal(page.personaKinds.length, 8)
  for (const [locale, dict] of dicts) {
    const m = dict.productPage.items.personal.myday
    assert.deepEqual(m.personas.map((x) => x.id), [...page.personaKinds], locale)
    for (const x of m.personas) {
      assert.equal(x.steps.length, 4, `${locale} ${x.id}`)
      assert.equal(x.asks.length, 3, `${locale} ${x.id}`)
      for (const step of x.steps) {
        assert.match(step.time, /^\d\d:\d\d$/)
        assert.ok(personalHand.includes(step.hand), `${locale} ${x.id} ${step.hand}`)
        assert.ok(words([step.text]) <= 14, `${locale} ${x.id} step is short`)
      }
    }
  }
})

test('channels: seven equals, Telegram is not first, and Telegram is named only in the channels strip', () => {
  assert.deepEqual([...page.personalChannelOrder].sort(), [...channelIds].sort())
  assert.notEqual(page.personalChannelOrder[0], 'telegram')
  assert.ok(page.personalChannelOrder.includes('telegram'))
  for (const [locale, dict] of dicts) {
    const v = visible(locale, dict)
    const outside = [...texts(v.rest)].filter((t) => /telegram|телеграм|бот\b|боты\b|бота\b/i.test(t))
    assert.deepEqual(outside, [], `${locale} outside the strip`)
    assert.ok(v.channels.some((t) => /Telegram/.test(t)), `${locale} the strip names it`)
  }
  // the lines under the page's own blocks (hero, objections, the unused older fields) do not call Telegram the default
  for (const [, dict] of dicts) assert.doesNotMatch(JSON.stringify(dict.productPage.items.personal), /Telegram/)
})

test('short page: at most 1200 words of visible RU text, shorter than the old page, EN mirrors the shape', () => {
  for (const [locale, dict] of dicts) {
    const v = visible(locale, dict)
    const n = words(v.channels) + words([...texts(v.rest)])
    assert.ok(n <= (locale === 'ru' ? 1200 : 1300), `${locale} ${n} words`)
    assert.ok(n >= 150, `${locale} ${n} words, is the count wired`)
  }
  const shape = (v) => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v)
  assert.deepEqual(shape(ru.productPage.items.personal), shape(en.productPage.items.personal))
})

test('the founder block is gone: no cases, no memory, no pilot on the Personal AI page, no Dono or Polly', () => {
  const sections = productPages.personal.sections
  for (const id of ['cases', 'memory', 'lives', 'setup', 'pilot', 'offer', 'included', 'price']) assert.ok(!sections.includes(id), id)
  const blocks = readFileSync('src/components/product-sections/personal-blocks.tsx', 'utf8')
  assert.doesNotMatch(blocks, /Dono|Polly|cases/)
  for (const [, dict] of dicts) assert.doesNotMatch(JSON.stringify(dict.productPage.items.personal), /Dono|Polly/)
})

test('demo: signed out shows the lock plate over a still example, signed in the real chat with personaKind', () => {
  const live = readFileSync('src/components/product-sections/personal-live.tsx', 'utf8')
  // the lock plate is the v4 variant, shown for «out» and while the session is read, never a working chat
  assert.match(live, /<DemoGateBar[\s\S]*?variant="plate"/)
  assert.match(live, /const locked = me\.status === 'out' \|\| me\.status === 'loading'/)
  assert.match(live, /data-personal-demo=\{locked \? 'locked' : 'live'\}/)
  assert.match(live, /data-personal-example/)
  // the real chat goes through callPersona('personal', ...) with the chosen kind
  assert.match(live, /callPersona\('personal', locale, s\.id, value, kind\)/)
  const call = readFileSync('src/components/demo/persona-call.ts', 'utf8')
  assert.match(call, /personaKind/)
  // the example text is plain data from the dictionary, not a timer-driven script
  assert.doesNotMatch(live, /setTimeout|setInterval/)
  for (const [, dict] of dicts) {
    assert.ok(dict.demoGate.lockTitle && dict.demoGate.login && dict.demoGate.signup)
  }
})

test('chat: personaKind is an optional builder persona id; HQ gets it only for the personal persona', async () => {
  const base = { sessionId: SID, locale: 'ru', message: 'Что у меня сегодня?', page: '/ru/products/personal', persona: 'personal' }
  const ok = chatRequestSchema.safeParse({ ...base, personaKind: 'student' })
  assert.ok(ok.success)
  assert.equal(ok.data.personaKind, 'student')
  assert.ok(chatRequestSchema.safeParse(base).success)
  assert.equal(chatRequestSchema.safeParse({ ...base, personaKind: 'wizard' }).success, false)
  const hq = readFileSync('src/lib/chat-hq.ts', 'utf8')
  assert.match(hq, /req\.persona === 'personal' && req\.personaKind/)
  assert.match(readFileSync('src/lib/chat.ts', 'utf8'), /TODO\(agents\)/)
})

test('start: «Собрать для себя» opens the builder on the personal path with the Personal AI picked', () => {
  const href = page.personalBuilderHref('ru')
  assert.match(href, /^\/ru\/builder\?b=/)
  const build = decodeBuild(new URL(href, 'https://x.test').searchParams.get('b'))
  assert.deepEqual(build.products, ['personal'])
  assert.ok(build.personal)
  const withWho = decodeBuild(new URL(page.personalBuilderHref('en', 'doctor'), 'https://x.test').searchParams.get('b'))
  assert.equal(withWho.personal.who, 'doctor')
})
