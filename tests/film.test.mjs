// The home film (owner 2026-11-22): scenes over the home sections, Fira's lines, the pure placement
// helpers and the light mode contract.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { ACTIVE_LINE, activeScene, companionKinds, filmScenes, markInShot, sceneOf } from '../src/lib/film.ts'
import { homeSections } from '../src/lib/home.ts'
import { emotions } from '../src/lib/fira/pose.ts'
import { isProductId, productIds } from '../src/lib/product-ids.ts'

const read = (p) => readFileSync(p, 'utf8')
const dicts = { ru, en }

test('film: eight scenes cover every home section once, in the page order', () => {
  assert.deepEqual(filmScenes.map((s) => s.id), ['hello', 'pains', 'demo', 'team', 'office', 'solutions', 'process', 'final'])
  const flat = filmScenes.flatMap((s) => s.sections)
  assert.deepEqual(flat, homeSections.filter((s) => s !== 'footer'))
  for (const s of homeSections.filter((x) => x !== 'footer')) assert.ok(sceneOf(s), s)
  for (const s of filmScenes) assert.ok(emotions.includes(s.emotion), s.id)
  assert.equal(new Set(filmScenes.map((s) => s.emotion)).size >= 5, true, 'Fira changes pose through the film')
})

test('film: every scene has a line of Fira in both languages, text only, no prices', () => {
  for (const [locale, dict] of Object.entries(dicts)) {
    for (const s of filmScenes) {
      const line = dict.film.scenes[s.id]
      assert.ok(typeof line === 'string' && line.length > 20 && line.length < 160, `${locale} ${s.id}`)
      assert.doesNotMatch(line, /\$\s?\d|\d+\s?%/, `${locale} ${s.id}`)
    }
    for (const id of productIds) assert.ok(dict.film.team[id], `${locale} team.${id}`)
    assert.equal(dict.film.pains.items.length, 3)
    for (const item of dict.film.pains.items) assert.ok(isProductId(item.product), `${locale} pains ${item.id}`)
    assert.equal(dict.film.office.depts.length, 6)
    // The owner forbade live numbers about us on this scene: words only.
    assert.doesNotMatch(JSON.stringify(dict.film.office), /\d/, `${locale} office has no numbers`)
    for (const k of companionKinds) assert.ok(dict.film.companion.lines[k], `${locale} companion.${k}`)
  }
  assert.deepEqual(Object.keys(ru.film), Object.keys(en.film))
})

test('film: the active scene is the one under the line, a mark is in shot below the header', () => {
  const vh = 1000
  const line = vh * ACTIVE_LINE
  const tops = [
    { id: 'hello', top: -2000, bottom: line - 10 },
    { id: 'pains', top: line - 10, bottom: line + 900 },
    { id: 'demo', top: line + 900, bottom: line + 2000 },
  ]
  assert.equal(activeScene(tops, vh), 'pains')
  assert.equal(activeScene([{ id: 'hello', top: 0, bottom: 2000 }], vh), 'hello')
  assert.equal(activeScene([{ id: 'a', top: -900, bottom: -100 }, { id: 'b', top: 1200, bottom: 1800 }], vh), 'a', 'a gap keeps the last scene')
  assert.equal(activeScene([{ id: 'a', top: 900, bottom: 1800 }], vh), 'a', 'above the first scene: the first')
  assert.equal(activeScene([], vh), null)
  assert.equal(markInShot({ top: 100, bottom: 196 }, vh), true)
  assert.equal(markInShot({ top: 40, bottom: 136 }, vh), false, 'under the header')
  assert.equal(markInShot({ top: 950, bottom: 1046 }, vh), false, 'below the fold')
})

test('film: light mode and loading contract (phones, reduced motion, no WebGL, LCP)', () => {
  const stage = read('src/components/film/film-stage.tsx')
  assert.match(stage, /dynamic\(\(\) => import\('\.\/film-overlay'\)/, 'the WebGL overlay is its own chunk')
  assert.match(stage, /useReducedMotion/)
  assert.match(stage, /FILM_MIN_WIDTH/)
  assert.match(stage, /readyState === 'complete'/, 'waits for the page load')
  assert.match(stage, /requestIdleCallback/)
  const cue = read('src/components/film/film-cue.tsx')
  assert.match(cue, /FiraFlat/, 'every mark has the flat Fira in the server HTML')
  assert.doesNotMatch(cue, /'use client'/)
  const orbit = read('src/components/hero/hero-orbit.tsx')
  assert.match(orbit, /data-film-mark="hello"/, 'the hello mark sits on the big Fira of the hero scene')
  assert.doesNotMatch(read('src/app/[locale]/page.tsx'), /cue=\{cue\(filmScenes\[0\]\)\}/, 'no cue bubble with the small Fira in the hero')
  const overlay = read('src/components/film/film-overlay.tsx')
  assert.equal((overlay.match(/<FiraTurtle7\b/g) ?? []).length, 1, 'one WebGL Fira for the whole film')
  assert.match(overlay, /openGuideMenu\(\)/, 'she opens her menu (show the site, ask, build)')
  const page = read('src/app/[locale]/page.tsx')
  assert.match(page, /FilmSceneBlock/)
  assert.match(page, /<FilmStage/)
  assert.doesNotMatch(read('src/components/film/office-scene.tsx'), /useOfficeFeed|office\/public|ProofLive/, 'no live numbers about us')
})
