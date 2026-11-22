// Fira round five (2026-11-23): the standing turtle. Pure parts (rig proportions, detail flags, shell lamps, tuned
// emotions), the SVG fallback of each variant rendered to markup, the wiring of the files and the code budget.
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
const T5 = await import('../src/lib/fira/turtle5.ts')
const P = await import('../src/lib/fira/pose.ts')
const P3 = await import('../src/lib/fira/pose3.ts')
const C = await import('../src/lib/fira/contexts.ts')
const { FiraFallback5 } = await import('../src/components/fira/fira-fallback5.tsx')
const read = (f) => readFileSync(f, 'utf8')
const svg = (v, e, ctx) => renderToStaticMarkup(createElement(FiraFallback5, { variant: v, emotion: e, ctx }))
const count = (html, re) => (html.match(re) ?? []).length

test('four variants R S T U with a name and a caption naming the detail', () => {
  assert.deepEqual([...T5.turtles5], ['r', 's', 't', 'u'])
  assert.ok(T5.isTurtle5('t') && !T5.isTurtle5('n'))
  for (const v of T5.turtles5) assert.ok(T5.detail5[v].name.startsWith(v.toUpperCase()) && T5.detail5[v].caption.length > 30, v)
  assert.match(T5.detail5.r.caption, /очки/i)
  assert.match(T5.detail5.s.caption, /наушник/i)
  assert.match(T5.detail5.t.caption, /секци/i)
  assert.match(T5.detail5.u.caption, /очки/i)
  assert.match(T5.detail5.u.caption, /наушник/i)
})

test('detail flags: R glasses, S headphones, T lamps, U glasses and headphones; the pearl is on all four', () => {
  const f = (v) => [T5.detail5[v].glasses, T5.detail5[v].headphones, T5.detail5[v].segments]
  assert.deepEqual(f('r'), [true, false, false])
  assert.deepEqual(f('s'), [false, true, false])
  assert.deepEqual(f('t'), [false, false, true])
  assert.deepEqual(f('u'), [true, true, false])
  for (const v of T5.turtles5) assert.equal(T5.detail5[v].pearl, true)
  assert.equal(T5.detail5.r.listen, 'adjust')
  assert.equal(T5.adjustLift5('r', 'listening'), 1)
  assert.equal(T5.adjustLift5('s', 'listening'), 0)
  assert.equal(T5.earLift5('s', 'listening'), 1)
  assert.equal(T5.earLift5('u', 'listening'), 1)
  assert.equal(T5.earLift5('r', 'listening'), 0)
  assert.equal(T5.earLift5('s', 'idle'), 0)
  assert.ok(T5.flash5('thinking', Math.PI / 6) > T5.flash5('idle', Math.PI / 6), 'lenses flash while thinking')
})

test('rig proportions: standing, cute big head, MEDIUM shell', () => {
  const r = T5.ratios5()
  assert.ok(r.headToBody > 0.7 && r.headToBody < 1.0, `head to body ${r.headToBody}`)
  assert.ok(r.headToTotal > 0.35 && r.headToTotal < 0.45, `head share of the height ${r.headToTotal}`)
  assert.ok(r.shellToBody > 0.75 && r.shellToBody < 1.0, `shell height to body ${r.shellToBody}`)
  assert.ok(r.shellWidthToBody > 1.1 && r.shellWidthToBody < 1.4, `shell width to body ${r.shellWidthToBody}`)
  assert.ok(r.shellBehind > 0.2 && r.shellBehind < 0.6, `shell sticks out ${r.shellBehind} behind`)
  assert.ok(r.total > 2.5 && r.total < 3, 'upright: taller than wide')
  assert.ok(r.total > 2 * T5.rig5.body.rx * 2, 'standing, not a squat blob')
  assert.ok(T5.rig5.head.y - T5.rig5.head.r < T5.rig5.body.y + T5.rig5.body.ry, 'the head sits on the shoulders (overlaps the body: no gap)')
  assert.ok(T5.rig5.leg.y - T5.rig5.leg.r * 3 < T5.rig5.body.y - T5.rig5.body.ry + 0.3, 'legs reach into the body')
  assert.ok(T5.rig5.arm.y - T5.rig5.arm.r < T5.rig5.body.y + T5.rig5.body.ry, 'arms start on the body')
})

test('face: eyes under 17% of the head, every emotion reads (brows and lids move against idle)', () => {
  const maxEyeH = Math.max(...P.emotions.map((e) => T5.targets5[e].eyeH))
  assert.ok(T5.eyeShare5(maxEyeH) <= 0.17, `${T5.eyeShare5(maxEyeH)}`)
  assert.ok(T5.eyeShare5(1) >= 0.1, 'readable, not a pinhole')
  const idle = T5.targets5.idle
  for (const e of P.emotions) {
    if (e === 'idle') continue
    const t = T5.targets5[e]
    const moved = ['eyeH', 'eyeW', 'lidTop', 'lidBot', 'slant', 'browY', 'browTilt', 'smile', 'mouthO', 'lookX', 'lookY'].filter((c) => Math.abs(t[c] - idle[c]) > 0.08).length
    assert.ok(moved >= 2, `${e}: eyes, brows or mouth change (${moved})`)
  }
  assert.ok(T5.targets5.sorry.browTilt > 0.8 && T5.targets5.thinking.browTilt < -0.3, 'sorry worried, thinking stern brows')
  assert.ok(T5.targets5.idle.lidTop >= 0.1 && T5.targets5.idle.lidTop <= 0.3, 'calm half lids at rest')
  assert.deepEqual(Object.keys(T5.targets5).sort(), [...P.emotions].sort())
  assert.equal(Object.keys(P3.targets3.idle).length, Object.keys(T5.targets5.idle).length)
})

test('shell lamps: one to three segments per emotion and context, valid ids, no repeats', () => {
  for (const e of P.emotions) {
    for (const ctx of [undefined, ...C.pageContexts.map((c) => c.id)]) {
      const g = T5.segmentGlow(e, ctx)
      assert.ok(g.length >= 1 && g.length <= 3, `${e}/${ctx}: ${g.length}`)
      assert.equal(new Set(g.map((x) => x.seg)).size, g.length, 'no repeated segment')
      for (const x of g) assert.ok(Number.isInteger(x.seg) && x.seg >= 0 && x.seg < T5.SEGMENTS && x.amt > 0 && x.amt <= 1 && x.tint in T5.tintHex)
    }
  }
  const tints = (e) => T5.segmentGlow(e).map((x) => x.tint).join()
  assert.notEqual(tints('sorry'), tints('happy'), 'emotion changes the lamp colour')
  assert.notEqual(JSON.stringify(T5.segmentGlow('idle', 'products')), JSON.stringify(T5.segmentGlow('idle', '404')), 'the page changes the lamp')
  for (const id of C.pageContexts.map((c) => c.id)) assert.ok(T5.ctxLamp[id], `${id} has a lamp`)
})

test('SVG fallback per variant and emotion renders and differs; the details show in the markup', () => {
  for (const v of T5.turtles5) {
    const all = P.emotions.map((e) => svg(v, e))
    assert.equal(new Set(all).size, P.emotions.length, `${v}: every emotion differs`)
    for (const html of all) {
      assert.match(html, /<svg[^>]*viewBox="0 0 200 200"/)
      assert.ok(!html.includes('#ff9a8a'), 'no blush')
      assert.equal(count(html, /data-part="pearl"/g), 1, `${v}: the pearl`)
      assert.equal(count(html, /data-part="eye"/g), 2)
      assert.equal(count(html, /data-part="brow"/g), 2)
      assert.ok(!/NaN|undefined/.test(html), `${v}: no NaN in the markup`)
    }
  }
  assert.equal(new Set(T5.turtles5.map((v) => svg(v, 'idle'))).size, 4, 'four different figures')
  for (const v of T5.turtles5) {
    const html = svg(v, 'idle')
    assert.equal(count(html, /data-part="lens"/g), T5.detail5[v].glasses ? 2 : 0, `${v}: lenses`)
    assert.equal(count(html, /data-part="cup"/g), T5.detail5[v].headphones ? 2 : 0, `${v}: cups`)
    assert.equal(count(html, /data-part="lamp"/g) > 0, T5.detail5[v].segments, `${v}: lit lamps only on T`)
  }
  assert.equal(count(svg('s', 'listening'), /data-up="1"/g), 1, 'one cup is up at the ear while listening')
  assert.equal(count(svg('s', 'idle'), /data-up="1"/g), 0)
  assert.ok(count(svg('t', 'happy', 'products'), /data-part="lamp"/g) >= 2, 'T lights lamps by emotion and page')
  assert.notEqual(svg('t', 'idle', 'home'), svg('t', 'idle', '404'))
})

test('wiring: own lazy chunk, lab keeps round five behind ?round=5 (round six is the default), noindex, no sitemap', () => {
  const comp = read('src/components/fira/fira-turtle5.tsx')
  assert.match(comp, /import\('\.\/fira-scene5'\)/)
  assert.match(comp, /useReducedMotion/)
  assert.match(comp, /FiraFallback5/)
  const scene = read('src/components/fira/fira-scene5.tsx')
  assert.match(scene, /dpr=\{\[1, 1\.5\]\}/)
  assert.match(scene, /frameloop=\{active \? 'always' : 'never'\}/)
  assert.match(scene, /mouth\?: number/, 'lip-sync hook')
  assert.match(scene, /ctx\?: string/)
  const code = scene + read('src/components/fira/fira-kit5.ts') + comp
  assert.ok(!/blush|tongue|TextureLoader|useGLTF|useTexture/i.test(code), 'procedural, matte, no blush')
  for (const v of T5.turtles5) assert.match(read('src/components/fira/fira-lab5.tsx') + read('src/lib/fira/turtle5.ts'), new RegExp(`\\b${v}: \\{`))
  const page = read('src/app/[locale]/fira-lab/page.tsx')
  assert.match(page, /round === '4'/)
  assert.match(page, /round === '5'\) return <FiraLab5/)
  assert.match(page, /index: false/)
  assert.match(page, /\?solo=r/)
  const lab = read('src/components/fira/fira-lab5.tsx')
  assert.match(lab, /data-fira-caption/)
  assert.match(lab, /Вращать/)
  assert.match(lab, /Говорит/)
  assert.match(lab, /Размер/)
  const home = read('src/components/fira/fira.tsx')
  assert.ok(!/fira-scene5|fira-turtle5/.test(home), 'the public Fira component is untouched')
  const sm = read('src/app/sitemap.ts')
  assert.ok(!/fira-lab/.test(sm))
})

test('code budget: Fira code stays under 480 KB (raised from 260 KB for round five, to 440 KB for round seven)', () => {
  const files = [...readdirSync('src/components/fira').map((f) => `src/components/fira/${f}`), ...readdirSync('src/lib/fira').map((f) => `src/lib/fira/${f}`)]
  const total = files.reduce((n, f) => n + statSync(f).size, 0)
  assert.ok(total < 480 * 1024, `${total} bytes`)
  const r5 = ['src/lib/fira/turtle5.ts', 'src/components/fira/fira-kit5.ts', 'src/components/fira/fira-scene5.tsx', 'src/components/fira/fira-fallback5.tsx', 'src/components/fira/fira-turtle5.tsx', 'src/components/fira/fira-lab5.tsx']
  assert.ok(r5.reduce((n, f) => n + statSync(f).size, 0) < 60 * 1024, 'round five itself is under 60 KB')
})
