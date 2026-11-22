// Fira as the guide of the site (owner 2026-11-23): tour stops per page, the word-by-word splitter, the
// context to accessory map, no autoplay, and the light loading contract of the docked presence.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { accessoriesFor } from '../src/lib/fira/contexts.ts'
import { firaFace } from '../src/lib/fira/face.ts'
import { WORD_MS, bubbleMs, guideEmotion, pageContextFor, speechLang, splitWords, voiceFromStorage, wordCount, wordsShown } from '../src/lib/fira/guide.ts'
import { TOUR_AUTOSTART, TOUR_MAX, TOUR_MIN, homeStops, isExtra, pickStops } from '../src/lib/fira/tour.ts'
import { filmScenes } from '../src/lib/film.ts'

const read = (p) => readFileSync(p, 'utf8')

test('guide: the site face is the round-eight turtle', () => {
  assert.ok(['a', 'b', 'c', 'd'].includes(firaFace))
  for (const f of ['src/components/film/film-cue.tsx', 'src/components/chat/chat-avatar.tsx', 'src/components/fira/fira-guide.tsx', 'src/components/fira/fira-flat.tsx', 'src/components/film/film-overlay.tsx']) {
    const code = read(f)
    assert.doesNotMatch(code, /FiraFallback3|fira-fallback3/, `${f} has no round-three face`)
    assert.doesNotMatch(code, /variant=["'][a-m]["']/, `${f} types no letter of its own`)
  }
})

test('guide: word-by-word splitter, 180 ms a word, whole line at once without motion', () => {
  assert.equal(WORD_MS, 180)
  assert.deepEqual(splitWords('  Привет,   я Фира. '), ['Привет,', 'я', 'Фира.'])
  assert.deepEqual(splitWords(''), [])
  const words = splitWords('one two three four')
  assert.equal(wordsShown(words, 0), '')
  assert.equal(wordsShown(words, 2), 'one two')
  assert.equal(wordsShown(words, 99), 'one two three four')
  assert.equal(wordCount(4, 0), 1)
  assert.equal(wordCount(4, 179), 1)
  assert.equal(wordCount(4, 180), 2)
  assert.equal(wordCount(4, 5000), 4)
  assert.equal(wordCount(4, 0, 0), 4, 'perWord 0 (reduced motion) shows everything')
  assert.equal(bubbleMs('a b c', 1000), 3 * 180 + 1000)
})

test('guide: the context picks the accessory (glasses, headphones, laptop)', () => {
  assert.deepEqual(accessoriesFor(pageContextFor('/ru')), [])
  assert.deepEqual(accessoriesFor(pageContextFor('/en/')), [])
  assert.deepEqual(accessoriesFor(pageContextFor('/ru/builder')), ['glasses', 'laptop'])
  assert.deepEqual(accessoriesFor(pageContextFor('/ru/products/admin')), ['glasses'])
  assert.deepEqual(accessoriesFor(pageContextFor('/en/ai-team')), ['glasses'])
  assert.deepEqual(accessoriesFor(pageContextFor('/ru/cabinet')), ['glasses', 'laptop'])
  assert.deepEqual(accessoriesFor('chat'), ['headphones'], 'the chat puts the headphones on')
  assert.deepEqual(accessoriesFor(pageContextFor('/ru/something-new')), [], 'an unknown page: the bare base')
  assert.deepEqual(accessoriesFor(''), [], '404: bare')
  assert.equal(guideEmotion({ tour: false, pointing: false, chatOpen: false, menu: false, notFound: true, saying: true }), 'sorry', '404 says sorry')
  assert.equal(guideEmotion({ tour: true, pointing: false, chatOpen: true, menu: false, notFound: false, saying: true }), 'point')
  assert.equal(guideEmotion({ tour: false, pointing: false, chatOpen: true, menu: false, notFound: false, saying: false }), 'listening')
  assert.equal(guideEmotion({ tour: false, pointing: false, chatOpen: false, menu: false, notFound: false, saying: false }), 'idle')
})

test('guide: tour stops per page, 3 to 6, home walks the eight scenes, extras last', () => {
  assert.deepEqual(homeStops.map((s) => s.key), filmScenes.map((s) => s.id))
  assert.equal(homeStops.length, 8)
  for (const s of homeStops) assert.match(s.selector, /^\[data-film-scene="/)
  const product = pickStops(['top', 'capabilities', 'day', 'scope', 'included', 'price', 'next', 'questions', 'pilot'], 'product')
  assert.ok(product.length >= TOUR_MIN && product.length <= TOUR_MAX, String(product))
  assert.ok(product.includes('price') && product.includes('next'), 'price and the next steps are stops')
  assert.equal(product.indexOf('capabilities') < product.indexOf('price'), true, 'page order is kept')
  assert.deepEqual(pickStops(['top', 'levels', 'teams', 'agents', 'proof'], 'aiTeam'), ['top', 'levels', 'teams', 'agents', 'proof'])
  const builder = pickStops(['builder'], 'builder')
  assert.deepEqual(builder, ['builder', 'builderPrice', 'builderAsk'])
  assert.ok(isExtra('builder', 'builderAsk') && !isExtra('builder', 'builder'))
  assert.deepEqual(pickStops(['login'], 'cabinet'), ['login', 'loginAsk'])
  assert.deepEqual(pickStops([], 'product'), [])
  const spread = pickStops(Array.from({ length: 12 }, (_, i) => `h${i}`), 'service')
  assert.equal(spread.length, TOUR_MAX, 'a page without known anchors is spread over its headings')
  assert.equal(spread[0], 'h0')
  assert.equal(spread.at(-1), 'h11')
})

test('guide: every tour stop has a line in both languages', () => {
  for (const [locale, dict] of Object.entries({ ru, en })) {
    const g = dict.firaGuide
    for (const k of ['launcher', 'launcherAria', 'menuLabel', 'show', 'ask', 'build', 'next', 'finish', 'stop', 'done', 'noStops', 'home', 'notFound', 'voiceOn', 'voiceOff']) {
      assert.ok(typeof g[k] === 'string' && g[k].length > 1, `${locale} ${k}`)
    }
    for (const s of homeStops) assert.ok(dict.film.scenes[s.key], `${locale} scene ${s.key}`)
    for (const key of ['top', 'demo', 'capabilities', 'day', 'flow', 'scope', 'included', 'price', 'next', 'levels', 'teams', 'agents', 'proof', 'builder', 'builderPrice', 'builderAsk', 'login', 'loginAsk']) {
      assert.ok(g.tour[key] && g.tour[key].length < 130, `${locale} tour.${key}`)
    }
    for (const line of Object.values(g.tour)) assert.doesNotMatch(line, /\$\s?\d/, 'no prices in a tour line')
  }
  assert.deepEqual(Object.keys(ru.firaGuide), Object.keys(en.firaGuide))
  assert.deepEqual(Object.keys(ru.firaGuide.tour), Object.keys(en.firaGuide.tour))
  assert.equal(Object.keys(ru).at(-1), 'firaGuide', 'the section is appended at the end')
})

test('guide: never autoplays, never blocks reading, voice is off by default', () => {
  assert.equal(TOUR_AUTOSTART, false)
  const guide = read('src/components/fira/fira-guide.tsx')
  // The tour starts only from the menu item.
  assert.equal((guide.match(/startTour\(/g) ?? []).length, 0, 'startTour is never called, only passed as a handler')
  assert.match(guide, /onClick=\{startTour\}/)
  assert.doesNotMatch(guide, /TOUR_AUTOSTART\s*\)?\s*\{?\s*startTour/)
  assert.doesNotMatch(guide, /location\.hash|history\.(push|replace)State|router\./, 'tour state is not in the URL')
  assert.doesNotMatch(guide, /autoplay|autoPlay/i)
  assert.match(guide, /ArrowRight/)
  assert.match(guide, /'Escape'/)
  assert.match(guide, /speechSynthesis/)
  assert.doesNotMatch(guide, /fetch\(/, 'no server TTS')
  assert.equal(voiceFromStorage(null), false)
  assert.equal(voiceFromStorage('on'), true)
  assert.equal(speechLang('en'), 'en-US')
  assert.equal(speechLang('ru'), 'ru-RU')
})

test('guide: light loading contract: flat SVG first, 3D only wide, idle, with WebGL, one canvas', () => {
  const guide = read('src/components/fira/fira-guide.tsx')
  assert.match(guide, /FILM_MIN_WIDTH/, 'lg+ only')
  assert.match(guide, /requestIdleCallback/)
  assert.match(guide, /readyState === 'complete'/, 'after the load')
  assert.match(guide, /!reduce/)
  assert.match(guide, /!home && !film/, 'the film owns the canvas on the home page')
  assert.equal((guide.match(/<FiraTurtle7\b/g) ?? []).length, 1)
  assert.match(guide, /<FiraFallback7\b/)
  assert.match(read('src/components/fira/fira-turtle7.tsx'), /dynamic\(\(\) => import\('\.\/fira-scene7'\)/, 'the scene is its own chunk')
  const overlay = read('src/components/film/film-overlay.tsx')
  assert.equal((overlay.match(/<FiraTurtle7\b/g) ?? []).length, 1)
})

test('guide: the pages carry the anchors the tour needs', () => {
  for (const [f, re] of [
    ['src/components/product-sections/shell.tsx', /data-tour=\{id\}/],
    ['src/app/[locale]/builder/page.tsx', /data-tour="builder"/],
    ['src/app/[locale]/ai-team/page.tsx', /data-tour="levels"/],
    ['src/app/[locale]/cabinet/login/page.tsx', /data-tour="login"/],
    ['src/components/not-found/not-found-view.tsx', /data-not-found/],
  ]) assert.match(read(f), re, f)
})
