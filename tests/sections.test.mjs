// T1 of the motion storyboard (docs/motion-storyboard.md §2-3): section discovery, palette matching,
// the tokens block, copy rules and the CSS contract of the new classes.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { filmScenes } from '../src/lib/film.ts'
import { sectionAnchor } from '../src/lib/home.ts'
import {
  HOME_ANCHORS,
  LABEL_MAX,
  activeIndex,
  itemsFromSources,
  matchesQuery,
  neighbour,
  paletteKey,
  parseRailAttr,
  railAllowed,
  sectionProgress,
  sectionsFor,
  trimLabel,
} from '../src/lib/sections.ts'

const read = (p) => readFileSync(p, 'utf8')
const dicts = { ru, en }
// The storyboard's words that must never reach the UI (RU and EN).
const FORBIDDEN = /ролик|трейлер|эпизод|тайм-?код|сцена\s*\d|\btrailer\b|\bepisode\b|\btimecode\b|\bscene\s*\d/i

test('sections: the home rail is the film scenes, anchors from home.ts, labels in both languages', () => {
  for (const [locale, dict] of Object.entries(dicts)) {
    const items = sectionsFor(`/${locale}`, dict)
    assert.equal(items.length, filmScenes.length)
    items.forEach((it, i) => {
      assert.equal(it.id, sectionAnchor[filmScenes[i].sections[0]], `${locale} ${filmScenes[i].id}`)
      assert.ok(it.label.length > 2, `${locale} ${filmScenes[i].id}`)
    })
    for (const sc of filmScenes) assert.equal(HOME_ANCHORS[sc.id], sectionAnchor[sc.sections[0]], sc.id)
    assert.deepEqual(Object.keys(dict.rail.home), filmScenes.map((s) => s.id))
  }
  assert.deepEqual(sectionsFor('/ru', ru).map((x) => x.label), ['Старт', 'Знакомо?', 'Попробуйте', 'Команда', 'Офис', 'Решения', 'Этапы и цены', 'Вопросы'])
  assert.equal(sectionsFor('/en/', en)[7].label, 'Questions')
})

test('sections: every route resolves to a list (home) or to none (collected at runtime, or quiet)', () => {
  const routes = [
    '/ru', '/en', '/ru/products/company', '/ru/services/websites', '/ru/solutions', '/ru/solutions/salon', '/ru/ai-team',
    '/ru/ai-team/agent/lead-handler', '/ru/blog', '/ru/how-we-work', '/ru/compare', '/ru/referral', '/ru/security',
    '/ru/builder', '/ru/cabinet', '/ru/pay/1', '/ru/terms', '/ru/privacy', '/ru/status', '/ru/audit', '/ru/demo/x', '/ru/fira-lab', '/ru/nope',
  ]
  for (const r of routes) {
    const list = sectionsFor(r, ru)
    assert.ok(Array.isArray(list), r)
    if (!/^\/(ru|en)\/?$/.test(r)) assert.equal(list.length, 0, `${r} is filled from the DOM`)
  }
  for (const quiet of ['/ru/builder', '/ru/cabinet/login', '/ru/pay/1', '/ru/terms', '/ru/privacy', '/ru/status', '/ru/audit', '/ru/demo/x', '/ru/fira-lab']) {
    assert.equal(railAllowed(quiet), false, quiet)
  }
  for (const ok of ['/ru', '/ru/products/company', '/ru/how-we-work', '/ru/ai-team']) assert.equal(railAllowed(ok), true, ok)
})

test('sections: DOM collection (h2 with id, data-rail, data-rail-label), labels trimmed, duplicates dropped', () => {
  const items = itemsFromSources(
    [
      { id: 'stages', text: '  Как идёт работа над проектом от начала до конца  ' },
      { id: 'levels', text: 'x', rail: 'Ступени|Levels' },
      { id: 'a', text: 'ignored', railLabel: 'Свой' },
      { id: 'stages', text: 'dup' },
      { id: '', text: 'no id' },
      { id: 'empty', text: '   ' },
    ],
    'ru',
  )
  assert.deepEqual(items.map((i) => i.id), ['stages', 'levels', 'a'])
  assert.ok(items[0].label.length <= LABEL_MAX && items[0].label.endsWith('…'))
  assert.equal(items[1].label, 'Ступени')
  assert.equal(itemsFromSources([{ id: 'l', text: '', rail: 'Ступени|Levels' }], 'en')[0].label, 'Levels')
  assert.equal(parseRailAttr('Один', 'en'), 'Один')
  assert.equal(trimLabel('short'), 'short')
})

test('sections: active index and progress follow the line; the bottom activates the last', () => {
  const tops = [-900, -100, 300, 900]
  assert.equal(activeIndex(tops, 1000, 0.38), 2)
  assert.equal(activeIndex([500, 900], 1000, 0.38), 0, 'before the first: the first')
  assert.equal(activeIndex(tops, 1000, 0.38, true), 3)
  assert.equal(activeIndex([], 1000, 0.38), -1)
  assert.equal(sectionProgress([0, 400], 0, 1000, 0.2), 0.5)
  assert.equal(sectionProgress([0, 400], 1, 1000, 0.2), 0, 'the last has no next')
  assert.equal(sectionProgress([0, 100], 0, 1000, 0.62), 1, 'clamped')
  assert.equal(neighbour(5, 2, 1), 3)
  assert.equal(neighbour(5, 4, 1), 4)
  assert.equal(neighbour(5, 0, -1), 0)
})

test('palette: matching by label and aliases, openers', () => {
  assert.equal(matchesQuery('', 'Решения'), true)
  assert.equal(matchesQuery('реш', 'Решения'), true)
  assert.equal(matchesQuery('how work', 'Как работаем', 'how we work'), true)
  assert.equal(matchesQuery('zzz', 'Решения', 'solutions'), false)
  const key = (o) => ({ key: '', metaKey: false, ctrlKey: false, altKey: false, ...o })
  assert.equal(paletteKey(key({ key: 'k', metaKey: true }), false), true)
  assert.equal(paletteKey(key({ key: 'K', ctrlKey: true }), true), true, 'Ctrl+K works even in a field')
  assert.equal(paletteKey(key({ key: '/' }), false), true)
  assert.equal(paletteKey(key({ key: '/' }), true), false, '"/" never opens it inside an input')
  assert.equal(paletteKey(key({ key: 'k' }), false), false)
})

test('copy: rail, palette and sound exist in RU and EN with the same shape; no forbidden words', () => {
  const PA = read('src/lib/sections.ts')
  for (const k of Object.keys(ru.palette.pages)) assert.ok(PA.includes(`  ${k}: '`), `alias for ${k}`)
  for (const k of ['rail', 'palette', 'sound']) assert.deepEqual(Object.keys(ru[k]), Object.keys(en[k]), k)
  assert.deepEqual(Object.keys(ru.palette.pages), Object.keys(en.palette.pages))
  for (const [locale, dict] of Object.entries(dicts)) {
    const strings = JSON.stringify({ rail: dict.rail, palette: dict.palette, sound: dict.sound })
    assert.doesNotMatch(strings, FORBIDDEN, locale)
    assert.doesNotMatch(strings, /[–—]/, `${locale}: no dashes in copy`)
    assert.equal(dict.nav.cta, locale === 'ru' ? 'Собрать проект' : 'Build a project')
  }
  assert.equal(ru.palette.placeholder, 'Куда перейти?')
  assert.equal(en.palette.empty, 'Nothing found')
})

test('new components and CSS carry no forbidden words in strings', () => {
  const files = [...readdirSync('src/components/nav').map((f) => `src/components/nav/${f}`), 'src/components/sound-toggle.tsx', 'src/lib/sections.ts', 'src/lib/sound.ts']
  for (const f of files) assert.doesNotMatch(read(f).replace(/\/\/.*$/gm, ''), FORBIDDEN, f)
})

// The T1 block of globals.css: everything the rail, header label and palette add.
const css = read('src/app/globals.css')
const t1 = css.slice(css.indexOf('===== motion tokens (T1) ====='), css.indexOf('===== end motion tokens (T1) ====='))

test('css: the T1 block exists once, with the duration tokens and no new easing curves', () => {
  assert.ok(t1.length > 500)
  assert.equal(css.split('===== motion tokens (T1) =====').length, 2)
  for (const v of ['--dur-micro: 160ms', '--dur-base: 320ms', '--dur-scene: 700ms', '--dur-page-out: 160ms', '--dur-page-in: 260ms', '--scene-range: entry 10% cover 45%']) assert.ok(t1.includes(v), v)
  assert.doesNotMatch(t1, /cubic-bezier\(/)
  const m = read('src/lib/motion.ts')
  assert.match(m, /flight: \{ type: 'spring', bounce: 0\.15, duration: 0\.9 \}/)
  assert.match(m, /micro: 0\.16/)
  assert.match(m, /cold: 1\.8/)
})

test('css: no `transition: all`, no scale(0), no 100vh, every :hover sits inside (hover: hover)', () => {
  assert.doesNotMatch(t1, /transition:\s*all/)
  assert.doesNotMatch(t1, /scale\(0\)/)
  assert.doesNotMatch(t1, /100vh/)
  assert.doesNotMatch(t1, /\b(width|height|top|left|margin|padding)\s*:\s*[^;]*;\s*\}?\s*transition/)
  // Walk the block: a rule with :hover must be inside an @media that contains `hover: hover`.
  let depth = 0
  const stack = []
  for (const line of t1.split('\n')) {
    if (/^\s*@media/.test(line)) stack.push(line)
    if (line.includes('{')) depth++
    if (/:hover/.test(line) && line.includes('{')) assert.ok(stack.some((l) => /hover: hover/.test(l)), `hover outside media: ${line.trim()}`)
    if (line.includes('}')) {
      depth--
      if (stack.length && depth === 0) stack.length = 0
    }
  }
})

test('css: reduced motion and reduced transparency cover the new classes', () => {
  const rm = t1.slice(t1.indexOf('@media (prefers-reduced-motion: reduce)'))
  for (const c of ['.rail-pill', '.rail-label', '.rail-tick', '.rail-dot', '.palette-dim', '.section-label']) assert.ok(rm.includes(c), `reduced motion: ${c}`)
  const rt = t1.slice(t1.indexOf('@media (prefers-reduced-transparency: reduce)'))
  assert.ok(rt.includes('.rail-pill') && rt.includes('.palette-panel') && rt.includes('backdrop-filter: none'))
  // The shared block was extended, not duplicated.
  assert.equal(css.split('@media (prefers-reduced-transparency: reduce)').length - 1, 2)
})
