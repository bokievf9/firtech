// T4 of the motion storyboard (docs/motion-storyboard.md sections 6-7): the cold-open gate (pure rule and the
// pre-paint script, run in a vm against fake globals), the CSS contract of the overlay and the sound rules.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { COLD_KEY, COLD_MS, coldOpenScript, shouldColdOpen } from '../src/lib/cold-open.ts'
import { TICK_MIN_GAP_MS, cueAllowed } from '../src/lib/sound.ts'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'

const read = (p) => readFileSync(p, 'utf8')
const base = { path: '/ru', hash: '', scrollY: 0, hidden: false, reducedMotion: false, saveData: false, storage: 'new' }

test('gate: first visit on the home page opens', () => {
  assert.equal(shouldColdOpen(base), true)
  assert.equal(shouldColdOpen({ ...base, path: '/en/' }), true)
})

test('gate: key set, storage throws, hash, scrolled, hidden tab, reduced motion, Save-Data and other pages skip it', () => {
  for (const patch of [
    { storage: 'seen' },
    { storage: 'blocked' },
    { hash: '#demo' },
    { scrollY: 40 },
    { hidden: true },
    { reducedMotion: true },
    { saveData: true },
    { path: '/ru/builder' },
    { path: '/ru/products/admin' },
    { path: '/' },
  ]) {
    assert.equal(shouldColdOpen({ ...base, ...patch }), false, JSON.stringify(patch))
  }
})

// The pre-paint script is the same rule as plain JS: run it with fake globals and compare with the pure gate.
function runScript(env, throwOn) {
  const store = new Map(env.storage === 'seen' ? [[COLD_KEY, '1']] : [])
  const root = { dataset: {} }
  const sandbox = {
    location: { pathname: env.path, hash: env.hash },
    window: { scrollY: env.scrollY },
    document: { hidden: env.hidden, documentElement: root },
    matchMedia: () => ({ matches: env.reducedMotion }),
    navigator: { connection: { saveData: env.saveData } },
    localStorage: {
      getItem: (k) => {
        if (env.storage === 'blocked' || throwOn === 'get') throw new Error('blocked')
        return store.get(k) ?? null
      },
      setItem: (k, v) => {
        if (throwOn === 'set') throw new Error('quota')
        store.set(k, v)
      },
    },
  }
  vm.runInNewContext(coldOpenScript, sandbox)
  return { on: root.dataset.cold === 'on', written: store.get(COLD_KEY) }
}

test('script matches the gate, writes the key before it opens, never throws', () => {
  for (const patch of [{}, { storage: 'seen' }, { storage: 'blocked' }, { hash: '#x' }, { scrollY: 9 }, { hidden: true }, { reducedMotion: true }, { saveData: true }, { path: '/en' }, { path: '/ru/blog' }]) {
    const env = { ...base, ...patch }
    const r = runScript(env)
    assert.equal(r.on, shouldColdOpen(env), JSON.stringify(patch))
    if (r.on) assert.equal(r.written, '1')
  }
  assert.equal(runScript(base, 'set').on, false, 'a failing write skips the open (no repeat flashes)')
  assert.equal(runScript(base, 'get').on, false)
})

test('duration: the cold open is at most 1.8 s and the CSS timeline ends inside it', () => {
  assert.ok(COLD_MS <= 1800)
  const css = read('src/app/globals.css')
  const block = css.slice(css.indexOf('Cold open (T4'), css.indexOf('===== page transitions (T2)'))
  assert.match(block, /cold-hole 700ms[^;]*1100ms/)
  assert.match(block, /cold-gone 1ms linear 1800ms forwards/)
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\)/, 'the overlay only exists without reduced motion')
  assert.doesNotMatch(block, /scale\(0\)|transition:\s*all|100vh/)
  assert.match(block, /pointer-events: none/)
  assert.match(block, /^\.cold-open \{\s*display: none;/m)
})

test('overlay is aria-hidden, in the home page, the pre-paint script is in the layout head', () => {
  assert.match(read('src/components/home/cold-open.tsx'), /aria-hidden="true"/)
  assert.match(read('src/app/[locale]/page.tsx'), /<ColdOpen \/>/)
  const layout = read('src/app/[locale]/layout.tsx')
  assert.ok(layout.indexOf('<ColdOpenInit />') < layout.indexOf('</head>'))
})

test('sound: nothing plays off, before a gesture, or on /pay and /cabinet', () => {
  assert.equal(cueAllowed('/ru', true, true), true)
  assert.equal(cueAllowed('/ru', false, true), false)
  assert.equal(cueAllowed('/ru', true, false), false)
  for (const p of ['/ru/pay/abc', '/en/pay', '/ru/cabinet', '/en/cabinet/projects/1', '/pay/x']) assert.equal(cueAllowed(p, true, true), false, p)
  assert.equal(cueAllowed('/ru/pay-how', true, true), true)
  assert.equal(TICK_MIN_GAP_MS, 120)
})

test('sound: no files are loaded and no cue is long', () => {
  const src = read('src/lib/sound.ts')
  assert.doesNotMatch(src, /fetch\(|new Audio|\.m4a|\.webm|\.mp3/)
  assert.match(src, /gesture/)
})

test('copy: no forbidden film words in sound and cold open strings', () => {
  const words = /ролик|трейлер|эпизод|тайм-?код|trailer|episode|timecode/i
  assert.doesNotMatch(JSON.stringify(ru.sound), words)
  assert.doesNotMatch(JSON.stringify(en.sound), words)
  assert.doesNotMatch(read('src/components/home/cold-open.tsx') + read('src/lib/cold-open.ts'), /["'`>][^"'`<>]*(ролик|трейлер|эпизод|тайм-?код)/i)
})
