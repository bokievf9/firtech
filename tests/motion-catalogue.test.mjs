// Scene templates T-A..T-J (docs/motion-storyboard.md 5.1, wave T3): every template exists, its CSS is guarded by
// reduced-motion and (for the scrubbed ones) by @supports with a fallback, nothing moves a layout property, no
// scale(0), no 100vh, hover only behind (hover: hover), and the text of every wired page stays in the server HTML.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const css = readFileSync('src/app/globals.css', 'utf8')
const start = css.indexOf('Scene templates (T3')
assert.ok(start > 0, 'scene template CSS block exists')
const scene = css.slice(start)
const read = (p) => readFileSync(p, 'utf8')

const templates = ['title-reveal', 'section-rise', 'card-stack', 'blueprint', 'wipe', 'phone-chat', 'pin-step', 'parallax', 'tour-dot', 'nod-on-view', 'scene-once']

test('every template has a component file', () => {
  for (const t of templates) assert.ok(existsSync(`src/components/motion/${t}.tsx`), t)
})

test('motion tokens block is present exactly once, with the storyboard values', () => {
  assert.equal(css.split('/* motion tokens (T1) */').length, 2)
  for (const v of ['--dur-micro: 160ms', '--dur-base: 320ms', '--dur-scene: 700ms', '--dur-page-out: 160ms', '--dur-page-in: 260ms', '--scene-range: entry 10% cover 45%'])
    assert.ok(css.includes(v), v)
  const m = read('src/lib/motion.ts')
  assert.match(m, /flight: \{ type: 'spring', bounce: 0\.15, duration: 0\.9 \}/)
  assert.match(m, /dur = \{ micro: 160, base: 320, scene: 700/)
})

test('scrubbed templates: view() inside @supports, a not-supported fallback, and reduced motion', () => {
  assert.match(scene, /@media \(prefers-reduced-motion: no-preference\) \{\s*@supports \(animation-timeline: view\(\)\)/)
  assert.match(scene, /@supports not \(animation-timeline: view\(\)\)/)
  // animation-timeline comes after the animation shorthand in every rule that sets both
  for (const rule of scene.matchAll(/\{([^{}]*animation-timeline[^{}]*)\}/g)) {
    const body = rule[1]
    assert.ok(body.indexOf('animation:') < body.indexOf('animation-timeline'), body)
  }
  // the fallback hides only with scripting on (no-JS shows everything)
  assert.match(scene, /@supports not \(animation-timeline: view\(\)\) \{\s*@media \(scripting: enabled\)/)
})

test('hidden start states exist only with motion allowed (reduced motion = plain visible content)', () => {
  const idx = (s) => scene.indexOf(s)
  for (const hidden of ["[data-scene='pre'].scene-stack > *", "[data-scene='pre'].scene-chat > *", "[data-scene='pre'] > .scene-line-x", "[data-scene='pre'].scene-wipe-row .scene-wipe"]) {
    const at = idx(hidden)
    assert.ok(at > 0, hidden)
    const before = scene.slice(0, at)
    assert.ok(before.lastIndexOf('@media (prefers-reduced-motion: no-preference)') > before.lastIndexOf('@media (hover'), hidden)
  }
  // pin: only lg+, tall screens, motion allowed, scripting on
  assert.match(scene, /@media \(min-width: 1024px\) and \(min-height: 700px\) and \(prefers-reduced-motion: no-preference\) and \(scripting: enabled\) \{\s*\.scene-pin/)
  // drift: lg+, fine pointer, motion allowed
  assert.match(scene, /@media \(min-width: 1024px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/)
  // the title reveal is a CSS animation behind no-preference
  assert.match(scene, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.scene-w \{\s*animation: scene-word-in/)
})

test('scene keyframes animate only transform, opacity and clip-path', () => {
  const frames = [...scene.matchAll(/@keyframes (scene-[a-z-]+) \{([\s\S]*?)\n\}\n/g)]
  assert.ok(frames.length >= 6)
  for (const [, name, body] of frames) {
    const props = [...body.matchAll(/([a-z-]+):\s*[^;]+;/g)].map((m) => m[1])
    for (const p of props) assert.ok(['transform', 'opacity', 'clip-path'].includes(p), `${name} animates ${p}`)
  }
})

test('scene CSS: no transition: all, no scale(0), no 100vh, hover only behind (hover: hover)', () => {
  assert.doesNotMatch(scene, /transition:\s*all/)
  assert.doesNotMatch(scene, /scale\(0\)/)
  assert.doesNotMatch(scene, /\b100vh\b/)
  assert.doesNotMatch(scene, /(width|height|top|left|margin|padding)\s*:[^;]*;\s*\n\s*\}\s*\n\s*to\b/) // no layout in keyframes
  for (const m of scene.matchAll(/:hover/g)) {
    const before = scene.slice(0, m.index)
    assert.ok(before.lastIndexOf('@media (hover: hover) and (pointer: fine)') > before.lastIndexOf('}\n\n'), 'hover outside the hover media query')
  }
  // the pin track uses svh, never vh
  assert.match(scene, /min-height: 170svh/)
})

test('no template runs per-frame React state, no new dependencies, no forbidden words in the new files', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.dependencies['framer-motion'], undefined)
  for (const t of templates) {
    const src = read(`src/components/motion/${t}.tsx`)
    assert.doesNotMatch(src, /ролик|трейлер|эпизод|тайм-код|trailer|episode|timecode/i, t)
    assert.doesNotMatch(src, /useScroll|useTransform|useSpring/, `${t} drives CSS, not motion values`)
  }
})

test('Fira poses of the tour dot are server SVG passed in, no Fira code in the client bundle', () => {
  assert.doesNotMatch(read('src/components/motion/tour-dot.tsx'), /fira-flat|FiraFlat/)
  assert.doesNotMatch(read('src/components/motion/nod-on-view.tsx'), /fira-flat|FiraFlat/)
})

test('title reveal and the observers keep the text in server HTML', () => {
  const title = read('src/components/motion/title-reveal.tsx')
  assert.doesNotMatch(title, /'use client'/, 'T-A is plain server markup')
  assert.match(title, /split\(' '\)/)
  assert.match(title, /Math\.min\(i, 7\)/, 'the stagger stops at the eighth word')
  const once = read('src/components/motion/scene-once.tsx')
  assert.match(once, /data-scene="pre"/, 'the start state is a server attribute')
  assert.match(once, /IntersectionObserver/)
  const pin = read('src/components/motion/pin-step.tsx')
  assert.match(pin, /min-width: 1024px/)
  assert.match(pin, /prefers-reduced-motion: no-preference/)
})

test('the templates are wired into the page groups of the storyboard', () => {
  const uses = (file, ...names) => {
    const s = read(file)
    for (const n of names) assert.match(s, new RegExp(`<${n}\\b`), `${file} uses ${n}`)
  }
  uses('src/components/film/pains-section.tsx', 'CardStack', 'Wipe')
  uses('src/components/products/products-bento.tsx', 'CardStack')
  uses('src/components/ladder.tsx', 'Blueprint')
  uses('src/components/work-timeline.tsx', 'Blueprint')
  uses('src/components/solutions-home.tsx', 'CardStack')
  uses('src/components/home-agents.tsx', 'CardStack')
  uses('src/components/product-sections/story-blocks.tsx', 'Blueprint', 'PinStep', 'PhoneChat', 'CardStack', 'Wipe')
  uses('src/components/product-sections/common-blocks.tsx', 'TitleReveal', 'CardStack')
  uses('src/components/product-sections/company-blocks.tsx', 'Blueprint', 'TitleReveal')
  uses('src/components/product-sections/flagship-blocks.tsx', 'Blueprint', 'CardStack')
  uses('src/components/process.tsx', 'Blueprint')
  uses('src/components/service-variants.tsx', 'CardStack')
  uses('src/app/[locale]/services/[slug]/page.tsx', 'CardStack')
  uses('src/app/[locale]/solutions/page.tsx', 'CardStack', 'TitleReveal')
  uses('src/app/[locale]/solutions/[kind]/page.tsx', 'CardStack', 'TitleReveal')
  uses('src/app/[locale]/ai-team/page.tsx', 'CardStack', 'TitleReveal', 'TourDot')
  uses('src/app/[locale]/ai-team/[id]/page.tsx', 'CardStack', 'TitleReveal')
  uses('src/components/ai-team/together-flow.tsx', 'Blueprint')
  uses('src/components/ai-team/agent-blocks.tsx', 'Blueprint')
  uses('src/app/[locale]/how-we-work/page.tsx', 'Blueprint', 'TitleReveal')
  uses('src/app/[locale]/compare/page.tsx', 'Wipe', 'TitleReveal')
  uses('src/app/[locale]/referral/page.tsx', 'Blueprint', 'TitleReveal')
  assert.match(read('src/components/proof/proof-live.tsx'), /<CountUp/)
  assert.doesNotMatch(read('src/components/product-sections/story-blocks.tsx'), /CountUp/, 'no counters on prices or plans')
})

test('quiet routes are untouched: legal, status, pay, cabinet, builder have no scroll templates', () => {
  for (const f of ['src/components/legal-doc.tsx', 'src/app/[locale]/status/page.tsx', 'src/app/[locale]/pay/[number]/page.tsx', 'src/app/[locale]/builder/page.tsx']) {
    assert.doesNotMatch(read(f), /components\/motion\/|\.\/motion\//, f)
  }
})

test('count-up runs 900 ms, tabular numerals', () => {
  const s = read('src/components/count-up.tsx')
  assert.match(s, /duration: 0\.9/)
  assert.match(s, /tabular-nums/)
})
