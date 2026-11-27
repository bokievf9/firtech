// Copy repetition guard (owner 2026-11-23: «много повторений на сайте»). Public dictionary sections
// must not repeat a sentence of 8+ words under two different keys, and «Telegram» / «бот» appears only
// at allow-listed key paths (facts: Mini App, channel lists, the studio's own contacts, legal text).
// Shared boilerplate lives under ONE key and is rendered by a shared component.
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
const { default: en } = await import('../src/content/en.ts')

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

const skipped = new Set(['builder', 'builderCatalog', 'estimate', 'estimator', 'cabinet', 'admin', 'leadAuth', 'privacy', 'terms'])
const publicOf = (dict) => Object.fromEntries(Object.entries(dict).filter(([k]) => !skipped.has(k)))
const norm = (key) => key.replace(/\[\d+\]/g, '[]')

// Sentences that legitimately repeat in many places because every item of a list carries the same line.
// The first-reply promise and the guarantee are word for word the same everywhere by rule (sla and copy-qa tests), so it is exempt.
const promise = /5 минут|5 minutes|prices and timelines|цен и сроков|первый экран сайта|first screen of the website|агент отвечает на \{|agent answers \{/i
// English runs about a quarter longer than Russian, so its threshold is 10 words. Questions (FAQ headings that a
// department and its agent both ask) are not counted.
const sentencesOf = (text, min) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => !s.endsWith('?') && s.split(/\s+/).length >= min && !promise.test(s))

test('copy-dupes: no sentence of 8+ words repeats under two different keys', () => {
  for (const [name, dict, min] of [['ru', ru, 8], ['en', en, 10]]) {
    const seen = new Map()
    for (const [key, text] of strings(publicOf(dict))) {
      for (const s of sentencesOf(text, min)) {
        const keys = seen.get(s) ?? new Set()
        keys.add(norm(key))
        seen.set(s, keys)
      }
    }
    const hits = [...seen].filter(([, keys]) => keys.size > 1).map(([s, keys]) => `${name}: «${s}» at ${[...keys].join(' | ')}`)
    assert.deepEqual(hits, [], `${hits.length} repeated sentence(s):\n${hits.join('\n')}`)
  }
})

// Where Telegram may be named, each entry a reason (audit: docs/copy-audit-2026-11-23.md, «keep»):
const telegramAllowed = [
  /^hero\.tagline$/, // the AI-native positioning line names the three channels (owner contract 2026-11-25)
  /^products\.channelsLine$/, // the channels and languages line moved here from the hero (owner 2026-11-26)
  /^contact\./, // the studio's own contact options
  /^chat\./, // chat fallbacks that point to the studio's own contact
  /^booking\./, // the follow-up in Telegram after a request (a real option next to the others)
  /^faq\.items\[\d+\]\.a$/, // channel availability and the studio's own contact
  /^auditPage\./, // the audit result is delivered by the studio's own bot
  /^payHow\./, // payment methods
  /^pay\./, // payment
  /^statusPage\./, // status of the studio's own services
  /^referral\./,
  /^cta\./,
  /^privacy|^terms/,
  /^notFound\./, // search keywords and the Mini App label
  /^how\.tools\[/, // the channel list of how we work
  /^solutions\.items\.delivery\./, // a Mini App niche: Telegram is the platform
  /^showcase\.items\.delivery\./,
  /^productPage\.items\.miniapp\./, // the Mini App product itself
  /^products\.items\.miniapp\./,
  /miniapp$/i,
  /^serviceDetails\.bots\./, // the messengers service lists the channels
  /^services\.items\.bots\./,
  /^aiTeams\..*\.faq\[\d+\]\.a$/, // platform lists for publishing (Instagram, Telegram, YouTube)
  /^solutions\.items\.services\.faq\[0\]\.a$/, // the CRM answer names the Telegram Mini App (a product, not the default channel)
  /\bchannels?\b/, // a channel list
  /\.chips\[/, // channel chips
  /^(hero|showcase)\.demo\./, // mock labels next to the Telegram icon of the illustration
  /(^|\.)telegram[A-Za-z]*$/, // a field named telegram is the label of the channel itself
  /^[A-Za-z]+\.(links?|follow|ctaTelegram)$/,
  /^(nav|footer|blog)\./,
]
test('copy-dupes: «Telegram» stays out of default-channel copy', () => {
  const stray = []
  const rx = /telegram|телеграм|(?<![а-яё])бот/i
  for (const [name, dict] of [['ru', ru], ['en', en]]) {
    for (const [key, text] of strings(publicOf(dict))) {
      if (rx.test(text) && !telegramAllowed.some((a) => a.test(key))) stray.push(`${name}.${key}: ${text.slice(0, 90)}`)
    }
  }
  assert.deepEqual(stray, [], `${stray.length} stray Telegram mention(s):\n${stray.join('\n')}`)
})
