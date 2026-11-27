// T2 of the motion storyboard (docs/motion-storyboard.md section 4): the rank table, the direction rule and the CSS
// contract of the page transition.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { navDirection, routeRank } from '../src/lib/nav-direction.ts'

const read = (p) => readFileSync(p, 'utf8')

test('nav-direction: rank table of section 4', () => {
  const ranks = {
    '/ru': 0,
    '/en': 0,
    '/ru/solutions': 1,
    '/ru/ai-team': 1,
    '/ru/blog': 1,
    '/ru/builder': 1,
    '/ru/compare': 1,
    '/ru/how-we-work': 1,
    '/en/referral': 1,
    '/ru/security': 1,
    '/ru/status': 1,
    '/ru/audit': 1,
    '/ru/pay-how': 1,
    '/ru/services/sites': 1,
    '/ru/products/admin': 2,
    '/ru/solutions/salon': 2,
    '/ru/ai-team/director': 2,
    '/ru/ai-team/agent/director': 2,
    '/ru/blog/some-post': 2,
    '/ru/builder/estimate': 2,
  }
  for (const [path, rank] of Object.entries(ranks)) assert.equal(routeRank(path), rank, path)
  for (const path of ['/ru/terms', '/ru/privacy', '/ru/cabinet', '/ru/cabinet/login', '/ru/cabinet/reset', '/ru/pay/INV-1', '/ru/demo/abc', '/ru/fira-lab', '/ru/no-such-page', '/ru/products']) {
    assert.equal(routeRank(path), null, `${path} fades`)
  }
  assert.equal(routeRank('/ru/'), 0, 'a trailing slash is the same page')
})

test('nav-direction: deeper is forward, shallower is back, equal rank is a sibling jump', () => {
  assert.equal(navDirection('/ru', '/ru/products/admin'), 'forward')
  assert.equal(navDirection('/ru', '/ru/how-we-work'), 'forward')
  assert.equal(navDirection('/ru/how-we-work', '/ru/products/admin'), 'forward')
  assert.equal(navDirection('/ru/products/admin', '/ru/how-we-work'), 'back')
  assert.equal(navDirection('/ru/products/admin', '/ru'), 'back')
  assert.equal(navDirection('/en/solutions/salon', '/en/solutions'), 'back')
  assert.equal(navDirection('/ru/products/admin', '/ru/products/personal'), 'sibling')
  assert.equal(navDirection('/ru/how-we-work', '/ru/solutions'), 'sibling')
  // The mirror: every forward pair goes back the other way.
  for (const [a, b] of [['/ru', '/ru/blog'], ['/ru/blog', '/ru/blog/x'], ['/ru', '/ru/blog/x']]) {
    assert.equal(navDirection(a, b), 'forward')
    assert.equal(navDirection(b, a), 'back')
  }
})

test('nav-direction: legal, cabinet, pay, demo, 404 and the language switch fade, they never slide', () => {
  for (const quiet of ['/ru/terms', '/ru/privacy', '/ru/cabinet', '/ru/cabinet/login', '/ru/pay/X-1', '/ru/demo/abc', '/ru/fira-lab', '/ru/nope']) {
    assert.equal(navDirection('/ru', quiet), 'fade', `home to ${quiet}`)
    assert.equal(navDirection(quiet, '/ru'), 'fade', `${quiet} to home`)
    assert.equal(navDirection('/ru/products/admin', quiet), 'fade')
  }
  assert.equal(navDirection('/ru/products/admin', '/en/products/admin'), 'fade')
  assert.equal(navDirection('/ru', '/en'), 'fade')
  assert.equal(navDirection('/ru/how-we-work', '/ru/how-we-work'), 'fade')
})

const css = read('src/app/globals.css')
const block = css.slice(css.indexOf('/* ===== page transitions (T2)'))
const code = block.replace(/\/\*[\s\S]*?\*\//g, '') // the rules without their comments

test('page transition CSS: distances, durations from the tokens, direction through <html data-nav>', () => {
  for (const dir of ['forward', 'back', 'sibling']) assert.match(block, new RegExp(`:root\\[data-nav='${dir}'\\]`))
  assert.match(block, /--pt-out: -12px;\s*--pt-in: 16px;/, 'forward')
  assert.match(block, /--pt-out: 12px;\s*--pt-in: -16px;/, 'back mirrors forward')
  assert.match(block, /animation: pt-out var\(--dur-page-out\)/)
  assert.match(block, /animation: pt-in var\(--pt-in-dur\)/)
  assert.match(block, /--pt-in-dur: var\(--dur-page-in\)/)
  assert.match(block, /--dur-fira: 300ms/, 'the whole change stays within 300 ms')
  assert.match(css, /--dur-page-out: 160ms;[\s\S]*--dur-page-in: 260ms;/)
})

test('page transition CSS: header, rail, progress line, launcher and phone bar are named and never animate; the rail marker is excluded', () => {
  for (const n of ['pt-header', 'pt-rail', 'pt-progress', 'pt-launcher', 'pt-mobile-cta']) assert.match(block, new RegExp(`view-transition-name: ${n};`), n)
  assert.match(block, /::view-transition-group\(\.pt-chrome\) \{\s*animation: none;/)
  assert.match(block, /::view-transition-old\(\.pt-chrome\) \{\s*animation: none;\s*display: none;/)
  assert.match(block, /\.rail-fira,\s*\[data-progress-fira\] \{\s*view-transition-name: none;/, 'the rail Fira is not the shared element')
  assert.match(read('src/components/mobile-cta.tsx'), /data-mobile-cta/)
  assert.match(read('src/components/nav/section-rail.tsx'), /rail-fira/)
})

test('page transition CSS: the WebGL film Fira fades out, the shared Fira is named once on each side', () => {
  assert.match(block, /\.film-fira \{\s*view-transition-name: pt-film-fira;/)
  assert.match(block, /::view-transition-old\(\.pt-film\) \{\s*animation: pt-fade-out 120ms/)
  const overlay = read('src/components/film/film-overlay.tsx')
  assert.match(overlay, /dataset\.leaving/)
  assert.match(block, /\.film-fira\[data-leaving='true'\]/)
  assert.match(overlay, /120 ms/)
  // One element holds the name `fira` at a time: the hero's own Fira on the home page, the launcher's face elsewhere.
  const hero = read('src/components/hero/hero-orbit.tsx')
  assert.match(hero, /<ViewTransition name="fira" share="fira-morph" default="none">/)
  const guide = read('src/components/fira/fira-guide.tsx')
  assert.match(guide, /key=\{home \? 'home' : 'page'\} name=\{home \? undefined : 'fira'\} share="fira-morph"/)
  assert.equal((read('src/components/film/film-cue.tsx').match(/name="fira"/g) ?? []).length, 0, 'the scene marks do not carry the name')
  assert.match(block, /::view-transition-group\(\.fira-morph\) \{\s*animation-duration: var\(--dur-fira\);/)
  assert.match(block, /:root\[data-nav='fade'\]::view-transition-group\(\.fira-morph\) \{\s*animation: none;/, 'no morph on fade pages')
})

test('page transition CSS: reduced motion is a 150 ms fade, no slide, no morph', () => {
  const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduced, /--pt-out: 0px !important;/)
  assert.match(reduced, /--pt-in: 0px !important;/)
  assert.match(reduced, /::view-transition-new\(root\) \{\s*animation: pt-fade-in 150ms linear both;/)
  assert.match(reduced, /::view-transition-old\(root\) \{\s*animation: none;/)
  assert.match(reduced, /::view-transition-group\(\.fira-morph\) \{\s*animation: none;/)
})

test('page transition CSS: only transform and opacity, no ease-in, no scale(0), no layout properties, clicks pass through', () => {
  assert.doesNotMatch(code, /transition: all/)
  assert.doesNotMatch(code, /scale\(0\)/)
  assert.doesNotMatch(code, /\bease-in\b/)
  assert.doesNotMatch(code, /@keyframes[^{]*\{[^@]*\b(width|height|top|left|margin|padding)\s*:/)
  assert.match(block, /::view-transition \{\s*pointer-events: none;/)
  assert.match(block, /view-transition-name: root !important;/, 'the page is the root snapshot (React hides it otherwise)')
})

test('page transition wiring: the wrapper sits inside <main>, the chrome outside; no flag, no canary React, no new dependency', () => {
  const layout = read('src/app/[locale]/layout.tsx')
  const main = layout.slice(layout.indexOf('<main'), layout.indexOf('</main>'))
  assert.match(main, /<PageTransition>\{children\}<\/PageTransition>/)
  for (const chrome of ['<Header', '<NavLayer', '<Footer', '<ChatWidget', '<MobileCta']) assert.ok(layout.indexOf(chrome) > -1 && !main.includes(chrome), `${chrome} is outside the transition`)
  assert.match(layout, /data-scroll-behavior="smooth"/, 'smooth scroll is switched off during route changes')
  const comp = read('src/components/nav-types.tsx')
  assert.match(comp, /key=\{pathname\}/)
  assert.match(comp, /navDirection\(from, pathname\)/)
  assert.doesNotMatch(read('next.config.ts'), /viewTransition/)
  const pkg = JSON.parse(read('package.json'))
  assert.match(pkg.dependencies.react, /^\^?19\./)
  assert.doesNotMatch(pkg.dependencies.react + pkg.dependencies['react-dom'], /canary|experimental/)
})

test('page transition copy: no film words in the new code', () => {
  const words = /ролик|трейлер|эпизод|тайм-?код|\btrailer\b|\bepisode\b|\btimecode\b/i
  for (const f of ['src/lib/nav-direction.ts', 'src/components/nav-types.tsx']) assert.doesNotMatch(read(f), words, f)
  assert.doesNotMatch(block, words)
})
