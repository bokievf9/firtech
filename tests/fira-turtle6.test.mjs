// Fira round six (2026-11-23): the owner's verdict on round five as numbers: proportions, accessory flags per variant,
// SVG fallbacks, wiring and the code budget.
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
const T6 = await import('../src/lib/fira/turtle6.ts')
const P = await import('../src/lib/fira/pose.ts')
const C = await import('../src/lib/fira/contexts.ts')
const { FiraFallback6 } = await import('../src/components/fira/fira-fallback6.tsx')
const read = (f) => readFileSync(f, 'utf8')
const svg = (v, e, ctx) => renderToStaticMarkup(createElement(FiraFallback6, { variant: v, emotion: e, ctx }))
const count = (html, re) => (html.match(re) ?? []).length

test('four variants V W X Y with a name and a caption', () => {
  assert.deepEqual([...T6.turtles6], ['v', 'w', 'x', 'y'])
  assert.ok(T6.isTurtle6('w') && !T6.isTurtle6('r'))
  for (const v of T6.turtles6) assert.ok(T6.detail6[v].name.startsWith(v.toUpperCase()) && T6.detail6[v].caption.length > 30, v)
})

test('proportions: head at most 33% of the height, thin shell hugging the back, one-colour body', () => {
  const r = T6.ratios6()
  assert.ok(r.headToTotal <= 0.33 && r.headToTotal >= 0.28, `head share ${r.headToTotal}`)
  assert.ok(r.shellDepthToBodyW <= 0.3 && r.shellDepthToBodyW >= 0.15, `shell depth / body width ${r.shellDepthToBodyW}`)
  assert.ok(r.shellToBody > 0.7 && r.shellToBody < 1, `medium shell height ${r.shellToBody}`)
  assert.ok(r.shellOverlap >= 0 && r.shellOverlap <= 0.15, `the shell hugs the back without a gap ${r.shellOverlap}`)
  assert.ok(r.total > 2.2 && r.total < 2.7 && r.total > r.bodyW * 1.8, 'upright')
  assert.ok(T6.rig6.head.y - T6.rig6.head.r < T6.rig6.body.y + T6.rig6.body.ry, 'the head sits on the shoulders')
  assert.ok(T6.rig6.arm.y < T6.rig6.body.y + T6.rig6.body.ry, 'arms start on the body')
  for (const v of T6.turtles6) {
    const d = T6.detail6[v]
    assert.equal(d.belly, false, `${v}: no belly plate`)
    assert.equal(d.tail, true)
    assert.equal(d.claws, 3)
    assert.equal(d.pearl, true)
    assert.equal(d.blush, true)
  }
})

test('accessory flags: V headphones on head + laptop, W glasses + neck headphones + laptop, X glasses + laptop, Y headphones only', () => {
  const f = (v) => [T6.detail6[v].glasses, T6.detail6[v].headphones, T6.detail6[v].laptop]
  assert.deepEqual(f('v'), [false, 'head', true])
  assert.deepEqual(f('w'), [true, 'neck', true])
  assert.deepEqual(f('x'), [true, null, true])
  assert.deepEqual(f('y'), [false, 'head', false])
  assert.equal(T6.laptopOpen6('v', 'thinking'), 1)
  assert.equal(T6.laptopOpen6('x', 'talking'), 1)
  assert.equal(T6.laptopOpen6('v', 'idle'), 0)
  assert.equal(T6.laptopOpen6('y', 'thinking'), 0, 'Y has no laptop')
  assert.equal(T6.cupLift6('y', 'listening'), 1)
  assert.equal(T6.cupLift6('x', 'listening'), 0)
  assert.ok(T6.lensFlash6('thinking', Math.PI / 6) > T6.lensFlash6('idle', Math.PI / 6))
})

test('the laptop screen takes the page colour of every context', () => {
  const seen = new Set()
  for (const c of C.pageContexts) seen.add(T6.screenHex6(c.id, '#c6ff3d'))
  assert.ok(seen.size >= 3, 'pages give different screen colours')
  assert.equal(T6.screenHex6(undefined, '#c6ff3d'), '#c6ff3d')
})

test('turning: faces the viewer by default, the whole body turns toward the pointer, a slow look-around cycle', () => {
  assert.ok(Math.abs(T6.bodyYaw6(0, 99, 0, true)) < 0.3, 'front three-quarter at rest')
  assert.ok(T6.bodyYaw6(1, 0, 0, true) - T6.bodyYaw6(-1, 0, 0, true) > 1, 'a pointer at the edges turns the body by more than a radian')
  assert.ok(T6.bodyYaw6(-1, 0, 0, true) < T6.BASE_YAW6 && T6.bodyYaw6(1, 0, 0, true) > T6.BASE_YAW6)
  const ys = Array.from({ length: 400 }, (_, i) => T6.bodyYaw6(0, 99, i * 0.1, true))
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.6, 'the cycle looks around')
  assert.ok(Math.max(...ys.map((v, i) => (i ? Math.abs(v - ys[i - 1]) : 0))) < 0.03, 'and slowly')
  assert.equal(T6.bodyYaw6(1, 0, 0, false), T6.bodyYaw6(0, 99, 0, false), 'follow off: no pointer')
})

test('face: bigger round pupils, soft lower lids, expressive brows, every emotion reads', () => {
  const maxEyeH = Math.max(...P.emotions.map((e) => T6.targets6[e].eyeH))
  assert.ok(T6.eyeShare6(maxEyeH) <= 0.24, `${T6.eyeShare6(maxEyeH)}`)
  assert.ok(T6.eyeShare6(1) >= 0.16, 'bigger than round five (12%)')
  const idle = T6.targets6.idle
  assert.ok(idle.lidBot > 0 && idle.lidBot <= 0.15, 'soft lower lid at rest')
  assert.ok(idle.lidTop <= 0.1, 'round open pupils')
  assert.ok(idle.smile >= 0.4, 'a small smile')
  for (const e of P.emotions) {
    if (e === 'idle') continue
    const t = T6.targets6[e]
    const moved = ['eyeH', 'eyeW', 'lidTop', 'lidBot', 'slant', 'browY', 'browTilt', 'smile', 'mouthO', 'lookX', 'lookY'].filter((c) => Math.abs(t[c] - idle[c]) > 0.08).length
    assert.ok(moved >= 2, `${e}: ${moved}`)
  }
  assert.ok(T6.targets6.sorry.browTilt > 0.8 && T6.targets6.thinking.browTilt < -0.3)
  assert.deepEqual(Object.keys(T6.targets6).sort(), [...P.emotions].sort())
})

test('SVG fallback per variant and emotion: renders, differs, shows blush, tail, claws, eye highlights and the variant accessories', () => {
  for (const v of T6.turtles6) {
    const all = P.emotions.map((e) => svg(v, e))
    assert.equal(new Set(all).size, P.emotions.length, `${v}: every emotion differs`)
    for (const html of all) {
      assert.match(html, /<svg[^>]*viewBox="0 0 200 200"/)
      assert.equal(count(html, /data-part="pearl"/g), 1)
      assert.equal(count(html, /data-part="eye"/g), 2)
      assert.equal(count(html, /data-part="hl"/g), 4, 'two highlights per eye')
      assert.equal(count(html, /data-part="brow"/g), 2)
      assert.equal(count(html, /data-part="blush"/g), 2)
      assert.equal(count(html, /data-part="tail"/g), 1)
      assert.equal(count(html, /data-part="claw"/g), 12, 'three claws on each of four limbs')
      assert.ok(!/NaN|undefined/.test(html), `${v}: no NaN`)
    }
    const html = svg(v, 'idle')
    const d = T6.detail6[v]
    assert.equal(count(html, /data-part="lens"/g), d.glasses ? 2 : 0)
    assert.equal(count(html, /data-part="cup"/g), d.headphones ? 2 : 0)
    assert.equal(count(html, /data-part="laptop"/g), d.laptop ? 1 : 0)
    assert.equal(count(html, /data-part="body"/g), 1)
  }
  assert.equal(new Set(T6.turtles6.map((v) => svg(v, 'idle'))).size, 4)
  assert.match(svg('v', 'thinking'), /data-open="1"/)
  assert.match(svg('v', 'idle'), /data-open="0"/)
  assert.notEqual(svg('x', 'thinking', 'home'), svg('x', 'thinking', '404'), 'the screen takes the page colour')
  assert.equal(count(svg('y', 'listening'), /data-up="1"/g), 1)
})

test('wiring: own lazy chunk, lab keeps round six at ?round=6 (?round=5, 4, 3 keep the old ones), blush on both themes, no textures', () => {
  const comp = read('src/components/fira/fira-turtle6.tsx')
  assert.match(comp, /import\('\.\/fira-scene6'\)/)
  assert.match(comp, /useReducedMotion/)
  assert.match(comp, /FiraFallback6/)
  const scene = read('src/components/fira/fira-scene6.tsx')
  assert.match(scene, /dpr=\{\[1, 1\.5\]\}/)
  assert.match(scene, /frameloop=\{active \? 'always' : 'never'\}/)
  assert.match(scene, /mouth\?: number/, 'lip-sync hook')
  assert.match(scene, /bodyYaw6/, 'the whole body turns')
  assert.ok(!/TextureLoader|useGLTF|useTexture/.test(scene + read('src/components/fira/fira-kit6.ts')), 'procedural')
  const kit = read('src/components/fira/fira-kit6.ts')
  assert.match(kit, /p\.dark \? [0-9.]+ : [0-9.]+/, 'blush strength per theme')
  assert.match(kit, /p\.blush/)
  const page = read('src/app/[locale]/fira-lab/page.tsx')
  assert.match(page, /round === '4'/)
  assert.match(page, /round === '5'\) return <FiraLab5/)
  assert.match(page, /round === '6'\) return <FiraLab6/)
  assert.match(page, /index: false/)
  const lab = read('src/components/fira/fira-lab6.tsx')
  assert.match(lab, /data-fira-caption/)
  assert.match(lab, /Вращать/)
  assert.match(lab, /Говорит/)
  assert.match(lab, /useState\(true\)/, 'follow the cursor on by default')
  assert.ok(!/fira-scene6|fira-turtle6/.test(read('src/components/fira/fira.tsx')), 'the public Fira component is untouched')
  assert.ok(!/fira-lab/.test(read('src/app/sitemap.ts')))
})

test('code budget: Fira code stays under 520 KB (raised for Fira live: store, chat, presence) (raised for round seven)', () => {
  const files = [...readdirSync('src/components/fira').map((f) => `src/components/fira/${f}`), ...readdirSync('src/lib/fira').map((f) => `src/lib/fira/${f}`)]
  const total = files.reduce((n, f) => n + statSync(f).size, 0)
  console.log(`fira code total ${total} bytes`)
  assert.ok(total < 520 * 1024, `${total} bytes`)
  const r6 = ['src/lib/fira/turtle6.ts', 'src/components/fira/fira-kit6.ts', 'src/components/fira/fira-scene6.tsx', 'src/components/fira/fira-fallback6.tsx', 'src/components/fira/fira-turtle6.tsx', 'src/components/fira/fira-lab6.tsx']
  const r6n = r6.reduce((n, f) => n + statSync(f).size, 0)
  console.log(`round six ${r6n} bytes`)
  assert.ok(r6n < 60 * 1024, 'round six itself is under 60 KB')
})
