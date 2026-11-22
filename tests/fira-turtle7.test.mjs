// Fira round seven (2026-11-23): the owner's reference art as numbers: proportions, accessory flags per variant,
// sheet names of the emotions, SVG fallbacks, wiring and the code budget.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
const T7 = await import('../src/lib/fira/turtle7.ts')
const P = await import('../src/lib/fira/pose.ts')
const { FiraFallback7 } = await import('../src/components/fira/fira-fallback7.tsx')
const read = (f) => readFileSync(f, 'utf8')
const svg = (v, e, dark = false) => renderToStaticMarkup(createElement(FiraFallback7, { variant: v, emotion: e, dark }))
const count = (html, re) => (html.match(re) ?? []).length

test('four variants A B C D named as the owner\'s accessories sheet', () => {
  assert.deepEqual([...T7.turtles7], ['a', 'b', 'c', 'd'])
  assert.ok(T7.isTurtle7('d') && !T7.isTurtle7('v'))
  assert.deepEqual(T7.turtles7.map((v) => T7.detail7[v].sheet), ['Базовая', 'Наушники', 'Очки', 'Ноутбук + очки'])
  for (const v of T7.turtles7) assert.ok(T7.detail7[v].name.startsWith(v.toUpperCase()) && T7.detail7[v].caption.length > 30, v)
})

test('proportions from the reference (433 x 355 px head on a 825 px figure): wide flat head, belly, shallow shell, outline', () => {
  const r = T7.ratios7()
  assert.ok(r.headToTotal >= 0.4 && r.headToTotal <= 0.45, `head height / total ${r.headToTotal} (reference 0.43)`)
  assert.ok(r.headAspect >= 1.15 && r.headAspect <= 1.35, `a wide flattened dome ${r.headAspect}`)
  assert.ok(r.headWToBodyW >= 1 && r.headWToBodyW <= 1.15, `head about as wide as the body ${r.headWToBodyW}`)
  assert.ok(r.shellDepthToBodyW <= 0.3, `shell depth ${r.shellDepthToBodyW} <= 0.3`)
  assert.ok(r.shellWidthToBody >= 1.25, 'the shell shows on both sides of the body')
  assert.ok(r.shellOverlap >= 0 && r.shellOverlap <= 0.15, `the shell hugs the back ${r.shellOverlap}`)
  assert.ok(T7.rig7.head.y - T7.rig7.head.ry < T7.rig7.body.y + T7.rig7.body.ry, 'the head sits on the shoulders')
  assert.ok(T7.rig7.arm.len < 0.7 && T7.rig7.arm.r > 0.1, 'short stubby arms')
  assert.deepEqual([T7.rig7.plastron.cols, T7.rig7.plastron.rows], [2, 3], 'plastron: 2 x 3 segments')
  for (const v of T7.turtles7) {
    const d = T7.detail7[v]
    assert.equal(d.belly, true, `${v}: the belly is back`)
    assert.equal(d.outline, true)
    assert.equal(d.toes, 3)
    assert.equal(d.tail, true)
    assert.equal(d.blush, true)
  }
})

test('accessory flags: A base, B headphones with lit rings, C glasses, D laptop + glasses', () => {
  const f = (v) => [T7.detail7[v].glasses, T7.detail7[v].headphones, T7.detail7[v].laptop, T7.detail7[v].ring]
  assert.deepEqual(f('a'), [false, false, false, false])
  assert.deepEqual(f('b'), [false, true, false, true])
  assert.deepEqual(f('c'), [true, false, false, false])
  assert.deepEqual(f('d'), [true, false, true, false])
  assert.equal(T7.laptopHeld7('d'), true)
  assert.equal(T7.laptopHeld7('c'), false)
})

test('notes float up from the headphones on listening in the dark theme only', () => {
  assert.equal(T7.notesOn7('b', 'listening', true), true)
  assert.equal(T7.notesOn7('b', 'listening', false), false)
  assert.equal(T7.notesOn7('b', 'idle', true), false)
  assert.equal(T7.notesOn7('a', 'listening', true), false, 'no headphones, no notes')
  const ys = Array.from({ length: 40 }, (_, i) => T7.noteState7(0, i * 0.09).y)
  assert.ok(ys.every((y) => y >= 0 && y <= 1) && Math.max(...ys) > 0.9 && Math.min(...ys) < 0.1, 'rises over the period')
  assert.ok(T7.noteState7(1, 0).y !== T7.noteState7(0, 0).y, 'notes are out of step')
  assert.equal(count(svg('b', 'listening', true), /data-part="note"/g), 3)
  assert.equal(count(svg('b', 'listening', false), /data-part="note"/g), 0)
})

test('emotions map to the names of the owner\'s sheet', () => {
  assert.equal(T7.sheetName7.idle, 'Чилл')
  assert.equal(T7.sheetName7.thinking, 'Всезнайка')
  assert.equal(T7.sheetName7.happy, 'Радость')
  assert.equal(T7.sheetName7.surprised, 'Удивление')
  assert.equal(T7.sheetName7.sorry, 'Скепсис')
  assert.equal(T7.sheetName7.listening, 'Довольная')
  assert.deepEqual(Object.keys(T7.sheetName7).sort(), [...P.emotions].sort())
  assert.deepEqual(T7.sheetOrder7.map((e) => T7.sheetName7[e]), ['Чилл', 'Всезнайка', 'Радость', 'Удивление', 'Скепсис', 'Довольная'])
})

test('face: half-lidded chill, one brow up for the know-it-all, closed smiling eyes, round eyes with a small o', () => {
  const t = T7.targets7
  assert.ok(t.idle.lidTop >= 0.3 && t.idle.lidTop <= 0.5, 'half-lidded')
  assert.ok(t.idle.smile >= 0.4 && t.idle.smile <= 0.7, 'small smile')
  assert.ok(t.thinking.asym >= 0.4 && t.thinking.browY > t.idle.browY + 0.3, 'brow up')
  assert.ok(t.happy.bend === 1 && t.happy.lidBot >= 0.4 && t.happy.lidTop === 0, 'closed arcs')
  assert.ok(t.surprised.lidTop === 0 && t.surprised.eyeH > 1.3 && t.surprised.mouthO > 0.5, 'round eyes, o mouth')
  assert.ok(t.sorry.asym >= 0.8 && Math.abs(t.sorry.smile) < 0.1, 'skeptic: one brow, flat mouth')
  assert.ok(t.listening.smile >= 0.6, 'content')
  assert.deepEqual(Object.keys(t).sort(), [...P.emotions].sort())
  assert.ok(T7.eyeShare7(Math.max(...P.emotions.map((e) => t[e].eyeH))) <= 0.4)
})

test('SVG fallback per variant and emotion: renders, differs, outline and every reference part', () => {
  for (const v of T7.turtles7) {
    const all = P.emotions.map((e) => svg(v, e))
    assert.equal(new Set(all).size, P.emotions.length, `${v}: every emotion differs`)
    for (const [i, html] of all.entries()) {
      const closed = count(html, /data-closed="1"/g)
      assert.match(html, /<svg[^>]*viewBox="80 70 920 920"/)
      assert.match(html, /data-outline="1"/)
      assert.equal(count(html, /data-part="plastron"/g), 1)
      assert.equal(count(html, /data-part="seg"/g), 3, 'one vertical and two horizontal lines: 2 x 3 segments')
      assert.equal(count(html, /data-part="shell"/g), 1)
      assert.equal(count(html, /data-part="scute"/g), 4, 'teal scutes on both sides')
      assert.equal(count(html, /data-part="body"/g), 1)
      assert.equal(count(html, /data-part="toe"/g), 6, 'three pale toes on each foot')
      assert.equal(count(html, /data-part="tail"/g), 1)
      assert.equal(count(html, /data-part="blush"/g), 2)
      assert.equal(count(html, /data-part="arm"/g), 2)
      assert.equal(count(html, /data-part="brow"/g), 2)
      assert.equal(count(html, /data-part="eye"/g), 2)
      assert.equal(count(html, /data-part="hl"/g), closed ? 0 : 4, `two highlights per open eye (${P.emotions[i]})`)
      assert.ok(!/NaN|undefined/.test(html), `${v}: no NaN`)
    }
    const html = svg(v, 'idle')
    const d = T7.detail7[v]
    assert.equal(count(html, /data-part="lens"/g), d.glasses ? 2 : 0)
    assert.equal(count(html, /data-part="cup"/g), d.headphones ? 2 : 0)
    assert.equal(count(html, /data-part="ring"/g), d.ring ? 2 : 0, 'lime ring on each cup')
    assert.equal(count(html, /data-part="band"/g), d.headphones ? 1 : 0)
    assert.equal(count(html, /data-part="laptop"/g), d.laptop ? 1 : 0)
    assert.equal(count(html, /data-part="logo"/g), d.laptop ? 1 : 0, 'lime logo on the lid')
  }
  assert.equal(new Set(T7.turtles7.map((v) => svg(v, 'idle'))).size, 4)
  assert.match(svg('b', 'idle'), /#c6ff3d/, 'the ring is lime')
  assert.notEqual(svg('a', 'idle'), svg('a', 'thinking'))
})

test('wiring: own lazy chunk, lab default is round seven (?round=6, 5, 4, 3 keep the old ones), outline pass, plastron, notes, no textures', () => {
  const comp = read('src/components/fira/fira-turtle7.tsx')
  assert.match(comp, /import\('\.\/fira-scene7'\)/)
  assert.match(comp, /useReducedMotion/)
  assert.match(comp, /FiraFallback7/)
  const scene = read('src/components/fira/fira-scene7.tsx')
  assert.match(scene, /dpr=\{\[1, 1\.5\]\}/)
  assert.match(scene, /frameloop=\{active \? 'always' : 'never'\}/)
  assert.match(scene, /mouth\?: number/, 'lip-sync hook')
  assert.match(scene, /bodyYaw6/, 'the whole body turns toward the pointer')
  assert.match(scene, /noteState7/, 'notes')
  assert.match(scene, /kit\.plastron/)
  const kit = read('src/components/fira/fira-kit7.ts')
  assert.match(kit, /BackSide/, 'inverted-hull toon outline')
  assert.match(kit, /uW/)
  assert.ok(!/TextureLoader|useGLTF|useTexture/.test(scene + kit), 'procedural')
  const page = read('src/app/[locale]/fira-lab/page.tsx')
  assert.match(page, /round === '4'/)
  assert.match(page, /round === '5'\) return <FiraLab5/)
  assert.match(page, /round === '6'\) return <FiraLab6/)
  assert.match(page, /round !== '3'\) return <FiraLab7/)
  assert.match(page, /index: false/)
  const lab = read('src/components/fira/fira-lab7.tsx')
  assert.match(lab, /data-fira-caption/)
  assert.match(lab, /sheetName7/)
  assert.match(lab, /Тёмная/)
  assert.match(lab, /Вращать/)
  assert.match(lab, /Говорит/)
  assert.match(lab, /useState\(true\)/, 'follow the cursor on by default')
  assert.ok(!/fira-scene7|fira-turtle7/.test(read('src/components/fira/fira.tsx')), 'the public Fira component is untouched')
  assert.ok(!/fira-lab/.test(read('src/app/sitemap.ts')))
  for (const f of ['ref-emotions', 'ref-accessories', 'ref-hero-glasses', 'ref-3d-chill', 'video-0.5', 'video-2', 'video-4', 'video-6']) assert.ok(statSync(`docs/fira-ref/${f}.jpg`).size > 10000, f)
})

test('code budget: Fira code stays under 440 KB (raised from 400 KB for round seven, which is about 56 KB)', () => {
  const files = [...readdirSync('src/components/fira').map((f) => `src/components/fira/${f}`), ...readdirSync('src/lib/fira').map((f) => `src/lib/fira/${f}`)]
  const total = files.reduce((n, f) => n + statSync(f).size, 0)
  console.log(`fira code total ${total} bytes`)
  assert.ok(total < 440 * 1024, `${total} bytes`)
  const r7 = ['src/lib/fira/turtle7.ts', 'src/components/fira/fira-kit7.ts', 'src/components/fira/fira-scene7.tsx', 'src/components/fira/fira-fallback7.tsx', 'src/components/fira/fira-turtle7.tsx', 'src/components/fira/fira-lab7.tsx']
  const n = r7.reduce((a, f) => a + statSync(f).size, 0)
  console.log(`round seven ${n} bytes`)
  assert.ok(n < 64 * 1024, 'round seven itself is under 64 KB')
})
