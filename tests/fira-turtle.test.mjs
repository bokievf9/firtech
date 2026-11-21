// Fira round four (2026-11-23): the turtle's pure parts (turtle.ts, contexts.ts) and the wiring of its files.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const T = await import('../src/lib/fira/turtle.ts')
const C = await import('../src/lib/fira/contexts.ts')
const P = await import('../src/lib/fira/pose.ts')
const P3 = await import('../src/lib/fira/pose3.ts')
const read = (f) => readFileSync(f, 'utf8')

test('four turtles with a name and a line each, different feel', () => {
  assert.deepEqual([...T.turtles], ['n', 'o', 'p', 'q'])
  for (const v of T.turtles) assert.ok(T.turtleInfo[v].name && T.turtleInfo[v].line)
  assert.ok(T.turtleFeel.p.tempo > T.turtleFeel.n.tempo && T.turtleFeel.q.tempo < T.turtleFeel.n.tempo, 'courier faster, wise slower')
  assert.ok(T.turtleFeel.p.blink[1] < T.turtleFeel.q.blink[0] + 1, 'courier blinks more often than the wise one')
})

test('eyes stay under 12% of the head height at the largest emotion', () => {
  const maxEyeH = Math.max(...P.emotions.map((e) => P3.targets3[e].eyeH))
  assert.ok(T.eyeShare4(maxEyeH) <= 0.12, `${T.eyeShare4(maxEyeH)}`)
})

test('accessories: all fourteen have a label and a hold; niche ones are named', () => {
  assert.equal(T.accessories.length, 14)
  for (const a of T.accessories) assert.ok(T.accessoryMeta[a].label, a)
  for (const a of ['hairdryer', 'stethoscope', 'tray', 'wrench', 'book', 'bag']) assert.ok(T.accessoryMeta[a].niche, a)
  assert.ok(T.isAccessory('laptop') && !T.isAccessory('hat'))
})

test('contexts: eight pages and six niches use real emotions and accessories', () => {
  assert.equal(C.pageContexts.length, 8)
  assert.equal(C.nicheContexts.length, 6)
  for (const c of C.allContexts) {
    assert.ok(P.isEmotion(c.emotion), c.id)
    if (c.acc) assert.ok(T.isAccessory(c.acc), c.id)
    if (c.event) assert.ok(T.isEventKind(c.event), c.id)
    assert.ok(c.line.length > 10 && !/бот|калькулятор|конструктор|приёмщик|[—–!]/i.test(c.line), `${c.id}: copy rules`)
  }
  assert.equal(new Set(C.pageContexts.map((c) => `${c.emotion}-${c.acc}`)).size, 8, 'pages differ in pose and accessory')
})

test('events: a pulse is strong at first, zero outside its duration; sound is off', () => {
  for (const k of T.eventKinds) {
    assert.ok(T.eventLevel(k, 0.05) > 0.2, k)
    assert.equal(T.eventLevel(k, -0.1), 0)
    assert.equal(T.eventLevel(k, T.eventSpec[k].dur + 0.1), 0)
    assert.equal(T.sfxCue(k), null)
  }
  assert.equal(T.sfx, 'off')
})

test('speech: words in order, envelope 0..1, silent between words, bubble holds 3 s then fades', () => {
  const tl = T.speechTimeline('Здравствуйте! Я Фира. Помогу собрать проект.')
  assert.equal(tl.words.length, 6)
  for (let i = 1; i < tl.words.length; i++) assert.ok(tl.words[i].start > tl.words[i - 1].end, 'gap between words')
  let loud = 0
  for (let t = 0; t < tl.total + 1; t += 0.01) {
    const a = T.ampAt(tl, t)
    assert.ok(a >= 0 && a <= 1)
    if (a > 0.4) loud++
  }
  assert.ok(loud > 20, 'the mouth really opens')
  const gap = (tl.words[0].end + tl.words[1].start) / 2
  assert.equal(T.ampAt(tl, gap), 0)
  assert.equal(T.ampAt(tl, 0.1), 0)
  assert.equal(T.bubbleAt(tl, 0).words, 0)
  assert.equal(T.bubbleAt(tl, tl.total + 0.01).words, 6)
  assert.equal(T.bubbleAt(tl, tl.total + 2.9).opacity, 1, 'still there after 2.9 s')
  assert.ok(T.bubbleAt(tl, tl.total + T.BUBBLE_HOLD + 0.25).opacity < 1)
  assert.ok(T.bubbleAt(tl, tl.total + T.BUBBLE_HOLD + T.BUBBLE_FADE + 0.1).done)
})

test('fidgets are scheduled inside each turtle range', () => {
  for (const v of T.turtles) for (const r of [0, 0.5, 0.99]) {
    const f = T.nextFidget(v, r, r)
    assert.ok(f.delay >= T.turtleFeel[v].fidget[0] && f.delay <= T.turtleFeel[v].fidget[1])
    assert.ok(T.fidgets.includes(f.kind))
  }
})

test('wiring: lazy chunk, lab round=4, lights layer, matte only, procedural only', () => {
  const comp = read('src/components/fira/fira-turtle.tsx')
  assert.match(comp, /import\('\.\/fira-scene4'\)/)
  assert.match(comp, /useReducedMotion/)
  const scene = read('src/components/fira/fira-scene4.tsx')
  assert.match(scene, /dpr=\{\[1, 1\.5\]\}/)
  assert.match(scene, /frameloop=\{active \? 'always' : 'never'\}/)
  assert.match(scene, /lights\?: LightMode/)
  assert.match(scene, /sfx\?: 'off'/)
  const kit = read('src/components/fira/fira-kit4.ts') + scene + read('src/components/fira/fira-acc4.tsx')
  assert.ok(!/blush|tongue|TextureLoader|useGLTF/i.test(kit), 'no blush, no textures')
  const page = read('src/app/[locale]/fira-lab/page.tsx')
  assert.match(page, /round[^\n]*'4'/)
  assert.match(page, /\?solo=n/)
  assert.match(read('src/components/fira/fira-lab4.tsx'), /data-fira-ctx/)
  const home = read('src/components/fira/fira.tsx')
  assert.ok(!/fira-scene4|fira-turtle/.test(home), 'the public Fira component is untouched')
})
