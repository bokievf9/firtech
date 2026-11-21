// Fira (2026-11-22): the mascot's pure parts and the contract of its files. The 3D scene is not run
// in node; the SVG fallback is rendered to markup (.tsx is transpiled by a load hook, no new dependency).
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx']) {
        try {
          return next(`${specifier}${ext}`, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.endsWith('.tsx')) return next(url, context)
    const out = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: fileURLToPath(url),
    })
    return { format: 'module', source: out.outputText, shortCircuit: true }
  },
})

const { renderToStaticMarkup } = await import('react-dom/server')
const { createElement } = await import('react')
const pose = await import('../src/lib/fira/pose.ts')
const mouth = await import('../src/lib/fira/mouth.ts')
const { palettes } = await import('../src/lib/fira/palette.ts')
const { FiraFallback } = await import('../src/components/fira/fira-fallback.tsx')
const { localePages } = await import('../src/lib/home.ts')

const read = (p) => readFileSync(p, 'utf8')

test('emotions and variants are the agreed lists', () => {
  assert.deepEqual([...pose.emotions], ['idle', 'thinking', 'happy', 'talking', 'point', 'sleep', 'wave', 'surprised'])
  assert.deepEqual([...pose.variants], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 'eight variants registered')
  assert.deepEqual([...pose.roundTwo], ['d', 'e', 'f', 'g', 'h'])
  assert.ok(pose.isRoundTwo('d') && pose.isRoundTwo('h') && !pose.isRoundTwo('c'))
  assert.ok(pose.isEmotion('happy') && !pose.isEmotion('angry') && !pose.isEmotion(undefined))
  assert.ok(pose.isVariant('c') && pose.isVariant('h') && !pose.isVariant('i'))
  for (const e of pose.emotions) {
    assert.ok(pose.targets[e], e)
    assert.ok(pose.breathHz[e] > 0, e)
    for (const c of pose.channels) assert.ok(Number.isFinite(pose.targets[e][c]), `${e}.${c}`)
  }
})

test('emotions differ in the way the brief asks', () => {
  const t = pose.targets
  assert.ok(t.thinking.pitch < 0 && t.thinking.lookY > 0.4, 'thinking looks up')
  assert.ok(Math.abs(t.thinking.roll) > 0.1 && t.thinking.glow > t.idle.glow, 'thinking tilts and pulses')
  assert.ok(t.happy.hop > 0 && t.happy.moon === 1, 'happy hops with arched eyes')
  assert.equal(t.sleep.open, 0)
  assert.equal(t.sleep.moon, -1)
  assert.equal(t.sleep.zzz, 1)
  assert.ok(t.sleep.pointer === 0 && t.sleep.breath > t.idle.breath, 'sleep ignores the pointer, breathes deeper')
  assert.equal(t.point.arm, 1)
  assert.ok(t.point.lean > 0)
  assert.equal(t.idle.hop, 0)
  assert.equal(t.wave.wave, 1, 'wave raises the arm')
  assert.ok(t.surprised.wide > 1.2 && t.surprised.browY === 1 && t.surprised.mouthO > 0.4, 'surprised: wide eyes, brows up, round mouth')
  assert.ok(t.thinking.browSplit === 1, 'thinking raises one brow')
  assert.ok(t.happy.grin > 0.5 && t.happy.tail === 1, 'happy grins, the tail curls')
})

test('mouth: five visemes, open grows with the voice, the grin never fights lip-sync', () => {
  const names = new Set()
  for (let a = 0; a <= 1; a += 0.02) for (const ph of [0, Math.PI / 2, Math.PI * 1.5]) {
    const v = pose.visemeAt(a, ph)
    names.add(v.name)
    for (const k of ['open', 'w', 'h', 'tongue']) assert.ok(Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 1, `${a} ${k}`)
  }
  assert.deepEqual([...names].sort(), ['ah', 'big', 'closed', 'ee', 'oh'])
  assert.equal(pose.visemeAt(0).name, 'closed')
  assert.equal(pose.visemeAt(1).name, 'big')
  assert.ok(pose.visemeAt(0.9, 0).h > pose.visemeAt(0.1, 0).h, 'taller when louder')
  assert.equal(pose.visemeAt(Number.NaN).name, 'closed')
  const quiet = pose.mouthShape(0.4, 0, 0, 0, 0)
  assert.equal(quiet.open, 0)
  const grin = pose.mouthShape(0.4, 0.85, 0, 0, 0)
  assert.ok(grin.open > 0.8 && grin.flat === 1)
  const o = pose.mouthShape(0, 0, 0.6, 0, 0)
  assert.ok(o.open > 0.5 && o.w < 0.6)
  const loud = pose.mouthShape(0.4, 0.85, 0, 1, 0)
  assert.equal(loud.open, 1)
  assert.ok(loud.flat === 0 && loud.h > 0.7, 'the voice wins over the grin')
})

test('spring converges, stays finite on a long frame, critical damping does not overshoot', () => {
  const s = { x: 0, v: 0 }
  for (let i = 0; i < 240; i++) pose.stepSpring(s, 1, 1 / 60, 140, 0.8)
  assert.ok(Math.abs(s.x - 1) < 0.001)
  const big = { x: 0, v: 0 }
  pose.stepSpring(big, 1, 0.5, 300, 0.2)
  assert.ok(Number.isFinite(big.x))
  const crit = { x: 0, v: 0 }
  let max = 0
  for (let i = 0; i < 300; i++) max = Math.max(max, pose.stepSpring(crit, 1, 1 / 60, 140, 1))
  assert.ok(max <= 1.0005)
})

test('blink is every 3 to 6 seconds and closes smoothly', () => {
  assert.equal(pose.blinkDelay(0), 3)
  assert.ok(pose.blinkDelay(0.5) === 4.5 && pose.blinkDelay(1) < 6 && pose.blinkDelay(2) < 6 && pose.blinkDelay(-1) === 3)
  assert.equal(pose.blinkClosed(0), 0)
  assert.equal(pose.blinkClosed(pose.BLINK_LEN), 0)
  assert.ok(Math.abs(pose.blinkClosed(pose.BLINK_LEN / 2) - 1) < 1e-9)
})

test('hop: never underground, stretches up, squashes on the way down', () => {
  let top = 0
  for (let t = 0; t < pose.HOP_PERIOD; t += 0.01) {
    const h = pose.hopCurve(t)
    assert.ok(h.y >= 0 && h.sy > 0.7 && h.sy < 1.2)
    top = Math.max(top, h.y)
  }
  assert.ok(top > 0.95 && top <= 1.0001)
  assert.ok(pose.hopCurve(0.15).sy < 1, 'crouch')
  assert.ok(pose.volumeXZ(0.8) > 1 && pose.volumeXZ(1.2) < 1)
})

test('pointer look is limited to the unit box', () => {
  assert.deepEqual(pose.clampLook(0, 0), { x: 0, y: 0 })
  assert.deepEqual(pose.clampLook(50, -50), { x: 1, y: -1 })
  assert.ok(Math.abs(pose.clampLook(0.8, 0).x - 0.5) < 1e-9)
})

test('mouth amplitude from audio bytes', () => {
  assert.equal(mouth.ampFromBytes([]), 0)
  assert.equal(mouth.ampFromBytes(new Uint8Array(256).fill(128)), 0, 'silence')
  const quiet = new Uint8Array(256).map((_, i) => 128 + (i % 2 ? 2 : -2))
  assert.equal(mouth.ampFromBytes(quiet), 0, 'noise under the gate')
  const loud = new Uint8Array(256).map((_, i) => (i % 2 ? 228 : 28))
  assert.equal(mouth.ampFromBytes(loud), 1, 'full scale clips to 1')
  const mid = new Uint8Array(256).map((_, i) => (i % 2 ? 158 : 98))
  const a = mouth.ampFromBytes(mid)
  assert.ok(a > 0.1 && a < 1, String(a))
  assert.ok(mouth.ampFromBytes(loud) >= a)
})

test('mouth smoothing: fast attack, slower release, stays in range', () => {
  const up = mouth.smoothAmp(0, 1, 1 / 60)
  const down = 1 - mouth.smoothAmp(1, 0, 1 / 60)
  assert.ok(up > down && up > 0 && up < 1)
  assert.equal(mouth.smoothAmp(0.4, 0.4, 0.1), 0.4)
  assert.equal(mouth.smoothAmp(0.3, 0.9, 0), 0.3)
})

test('fallback SVG renders without WebGL for every variant and emotion', () => {
  for (const v of pose.variants) {
    for (const e of pose.emotions) {
      const html = renderToStaticMarkup(createElement(FiraFallback, { variant: v, emotion: e }))
      assert.match(html, /^<svg /)
      assert.ok(html.includes(`data-fira-svg="${v}-${e}"`))
      assert.ok(html.includes('var(--color-accent)'), 'body uses the site token')
      assert.ok(html.includes('aria-hidden="true"'))
      assert.ok(!/#[0-9a-f]{6}/i.test(html.replace(/#ff9a8a/gi, '')), 'no hard-coded brand colours except the blush')
    }
  }
  assert.match(renderToStaticMarkup(createElement(FiraFallback, { variant: 'a', emotion: 'sleep' })), /M150 52h14/, 'z marks when asleep')
  for (const v of pose.roundTwo) assert.match(renderToStaticMarkup(createElement(FiraFallback, { variant: v, emotion: 'sleep' })), /M150 52h14/, `${v} z marks`)
  const shapes = new Set(pose.roundTwo.map((v) => renderToStaticMarkup(createElement(FiraFallback, { variant: v, emotion: 'idle' }))))
  assert.equal(shapes.size, 5, 'five different silhouettes')
  const emo = new Set(pose.emotions.map((e) => renderToStaticMarkup(createElement(FiraFallback, { variant: 'd', emotion: e }))))
  assert.equal(emo.size, pose.emotions.length, 'every emotion looks different in the fallback')
  assert.ok(!/key=/.test(renderToStaticMarkup(createElement(FiraFallback, { variant: 'e', emotion: 'wave' }))))
})

test('palette table matches the CSS tokens', () => {
  const css = read('src/app/globals.css')
  const light = css.slice(0, css.indexOf(":root[data-theme='dark'] {"))
  const dark = css.slice(css.indexOf(":root[data-theme='dark'] {"))
  const val = (block, name) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1]?.toLowerCase()
  for (const [theme, block] of [['light', light], ['dark', dark]]) {
    assert.equal(palettes[theme].accent, val(block, '--color-accent'), `${theme} accent`)
    assert.equal(palettes[theme].strong, val(block, '--color-accent-strong'), `${theme} strong`)
    assert.equal(palettes[theme].ink, val(block, '--color-accent-ink'), `${theme} ink`)
  }
  assert.equal(palettes.light.cream, val(css, '--color-paper'))
})

test('component files and exports', () => {
  const fira = read('src/components/fira/fira.tsx')
  assert.match(fira, /^'use client'/)
  assert.match(fira, /export function Fira\b/)
  assert.match(fira, /export \{ emotions, variants, roundTwo \}/)
  for (const prop of ['variant', 'emotion', 'size', 'lookAt', 'mouth', 'theme', 'spin']) assert.match(fira, new RegExp(`${prop}\\??:`))
  assert.match(fira, /dynamic\(\(\) => import\('\.\/fira-scene'\), \{ ssr: false \}\)/, 'scene is lazy')
  assert.match(fira, /useReducedMotion/)
  assert.match(fira, /IntersectionObserver/)
  assert.match(fira, /visibilitychange/)
  const scene = read('src/components/fira/fira-scene.tsx')
  assert.match(scene, /dpr=\{\[1, 1\.5\]\}/, 'dpr capped at 1.5')
  assert.match(scene, /frameloop=\{active \? 'always' : 'never'\}/)
})

// Budget raised from 60 KB to 160 KB in round two (five more characters, a clay shader, a face rig,
// the lab); still procedural code only, no assets (docs/fira.md).
test('procedural only: under 160 KB of code, no textures or external assets', () => {
  const files = [...readdirSync('src/components/fira').map((f) => `src/components/fira/${f}`), ...readdirSync('src/lib/fira').map((f) => `src/lib/fira/${f}`)]
  const total = files.reduce((n, f) => n + statSync(f).size, 0)
  assert.ok(total < 160 * 1024, `${total} bytes`)
  for (const f of files) {
    const code = read(f)
    assert.ok(!/TextureLoader|useTexture|useGLTF|\.(png|jpe?g|webp|glb|gltf|hdr)['"]/.test(code), f)
  }
})

test('round two: every new character is wired in the kit, the scene and the lab', () => {
  const chars = read('src/components/fira/fira-chars.tsx')
  for (const n of ['CharD', 'CharE', 'CharF', 'CharG', 'CharH']) assert.match(chars, new RegExp(`export function ${n}\\b`))
  const kit = read('src/components/fira/fira-kit2.ts')
  for (const v of pose.roundTwo) assert.match(kit, new RegExp(`\\b${v}: \\{\\s*\\n?\\s*scale`), `spec ${v}`)
  const scene2 = read('src/components/fira/fira-scene2.tsx')
  assert.match(scene2, /dpr=\{\[1, 1\.5\]\}/, 'dpr capped at 1.5')
  assert.match(scene2, /frameloop=\{active \? 'always' : 'never'\}/)
  const fira = read('src/components/fira/fira.tsx')
  assert.match(fira, /import\('\.\/fira-scene2'\)/, 'round two is its own lazy chunk')
  const lab = read('src/components/fira/fira-lab.tsx')
  assert.match(lab, /all \? variants : roundTwo/, 'round one hidden unless ?all=1')
  assert.match(lab, /sheetTiles/)
  assert.equal((lab.match(/\{ emotion: '/g) ?? []).length >= 9, true, 'sticker sheet has nine tiles')
  assert.match(read('src/app/[locale]/fira-lab/page.tsx'), /one\(sp\.all\) === '1'/)
})

test('the lab page is hidden: noindex, not in localePages or the sitemap', () => {
  const page = read('src/app/[locale]/fira-lab/page.tsx')
  assert.match(page, /index: false/)
  assert.ok(!localePages.includes('fira-lab'))
  assert.ok(!read('src/app/sitemap.ts').includes('fira'))
  assert.ok(!read('src/lib/i18n.ts').includes('fira'))
  assert.ok(!read('src/proxy.ts').includes('fira'))
  assert.ok(existsSync('docs/fira.md'))
})
