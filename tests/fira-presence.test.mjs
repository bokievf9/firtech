// Fira live 1.1, F2: the pure rules of the presence (state to emotion, the frame-rate guard, the 3D gate,
// reduced motion) and the wiring of the pieces (no quietRoute, the dock lift, one canvas).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { emotions } from '../src/lib/fira/pose.ts'
import { aimYaw, canUse3d, createFpsGuard, emotionOf, isLowEnd, isReactKind, peekKey, pickEmotion } from '../src/lib/fira/presence.ts'

const read = (p) => readFileSync(p, 'utf8')
const states = ['idle', 'listening', 'thinking', 'talking', 'happy', 'sorry', 'surprised', 'sleep', 'wave', 'point']

test('presence: every contract state maps 1:1 to a rig emotion', () => {
  assert.deepEqual([...states].sort(), [...emotions].sort())
  for (const s of states) assert.equal(emotionOf(s), s)
})

test('presence: a live state beats the page pose, idle yields to it, a wave beats both', () => {
  assert.equal(pickEmotion('idle', 'point', false), 'point')
  assert.equal(pickEmotion('thinking', 'point', false), 'thinking')
  assert.equal(pickEmotion('talking', 'idle', true), 'wave')
  assert.equal(pickEmotion('idle', 'idle', false), 'idle')
})

test('fps guard: 3 s under 30 fps trips it, a steady 60 fps never does, a hidden tab is not a measurement', () => {
  const slow = createFpsGuard()
  let tripped = false
  for (let i = 0; i < 400 && !tripped; i++) tripped = slow.push(1 / 20)
  assert.equal(tripped, true)
  const fast = createFpsGuard()
  for (let i = 0; i < 1200; i++) assert.equal(fast.push(1 / 60), false)
  assert.equal(fast.tripped(), false)
  const hidden = createFpsGuard()
  for (let i = 0; i < 50; i++) hidden.push(1 / 20)
  assert.equal(hidden.push(5), false, 'a 5 s gap resets the window')
  for (let i = 0; i < 50; i++) assert.equal(hidden.push(1 / 20), false)
  const short = createFpsGuard()
  for (let i = 0; i < 70; i++) assert.equal(short.push(1 / 20), false, 'under 3 s of slowness after warm-up is fine')
})

test('3D gate: reduced motion, phones, weak machines, a slow verdict, a second canvas all mean SVG', () => {
  const ok = { armed: true, seen: true, owns: true, reduced: false, narrow: false, lowEnd: false }
  assert.equal(canUse3d(ok), true)
  for (const k of [{ reduced: true }, { narrow: true }, { lowEnd: true }, { slow: true }, { disabled: true }, { owns: false }, { armed: false }, { seen: false }]) {
    assert.equal(canUse3d({ ...ok, ...k }), false, JSON.stringify(k))
  }
  assert.equal(isLowEnd({ hardwareConcurrency: 2 }), true)
  assert.equal(isLowEnd({ hardwareConcurrency: 8, deviceMemory: 8 }), false)
  assert.equal(isLowEnd({}), false)
})

test('aim and peeks: yaw is clamped, one peek key per block', () => {
  assert.equal(aimYaw(0), 0)
  assert.equal(aimYaw(100000), 0.7)
  assert.equal(aimYaw(-100000), -0.7)
  assert.notEqual(peekKey('/ru', 'pricing', 0), peekKey('/ru', 'pricing', 1))
  assert.equal(isReactKind('pricing'), true)
  assert.equal(isReactKind('cta'), true)
  assert.equal(isReactKind('x'), false)
})

test('wiring: no quietRoute, the dock lifts over a sticky bar, the stage honours reduced motion and one canvas', () => {
  const widget = read('src/components/chat/chat-widget.tsx')
  assert.doesNotMatch(widget, /quietRoute/)
  assert.match(widget, /data-fira-avoid/)
  assert.match(read('src/components/builder-nav.tsx'), /data-fira-avoid/)
  const stage = read('src/components/fira/fira-stage.tsx')
  assert.match(stage, /useReducedMotion/)
  assert.match(stage, /canvasOwner/)
  assert.match(stage, /requestIdleCallback/)
  assert.match(read('src/components/fira/fira-scene7.tsx'), /createFpsGuard/)
  assert.match(read('src/components/not-found/not-found-view.tsx'), /data-fira-target="home"/)
  assert.match(read('src/app/globals.css'), /prefers-reduced-motion: reduce\)[\s\S]*fira-svg-nod/)
})
