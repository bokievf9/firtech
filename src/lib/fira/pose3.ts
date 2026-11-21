// Round three («взрослая милота», 2026-11-22): the pose maths for I to M, free of three.js so it is
// tested in node. Same idea as pose.ts (one damped spring per channel chasing the emotion's target),
// a different channel set: grown-up faces act with eye geometry, lid angle, posture, light and tempo
// instead of big eyes and a mouth decal.
import type { Emotion, RoundThree } from './pose'

// Angles in radians. Eye sizes are multipliers of the variant's base eye (see eyeSpec).
export type T3 = {
  lean: number //   forward (+) / back (-), body
  roll: number //   side tilt, body (+ tips to her left)
  yaw: number //    turn toward the viewer's right (+)
  head: number //   head pitch on its joint, + looks down (J, L); others add it to lean
  headRoll: number
  lift: number //   vertical offset in body heights (perk +, sink -)
  squash: number // height scale
  eyeW: number
  eyeH: number
  eyeY: number //   eye centre offset, in eye heights
  lookX: number //  -1..1 gaze
  lookY: number
  lidTop: number // 0..1 cut from above
  lidBot: number // 0..1 cut from below (with bend: happy arcs)
  bend: number //   0..1 the lower cut curves up: ∩ arcs
  slant: number //  + outer ends down (sorry), - inner ends down (focus)
  asym: number //   + her right eye smaller and lower lid (thinking)
  ring: number //   0..1 the eye light becomes a ring (J)
  glow: number //   0..1 light of the eyes, lens, antenna
  warm: number //   -1 cool mint .. +1 warm yellow, colour of the light
  smile: number //  -1 down .. +1 up, mouth line (L, M)
  mouthW: number // mouth line width multiplier
  mouthO: number // 0..1 a small round o
  browY: number //  brow lift (M)
  browTilt: number // + inner ends up (worried), - inner ends down (stern)
  arm: number //    0..1 the point gesture arm (L)
  wave: number //   0..1 greeting sway
  breath: number // breathing amplitude (height fraction)
  zzz: number
  pointer: number // weight of the pointer follow
}
export type Channel3 = keyof T3
export const channels3 = [
  'lean', 'roll', 'yaw', 'head', 'headRoll', 'lift', 'squash', 'eyeW', 'eyeH', 'eyeY', 'lookX', 'lookY',
  'lidTop', 'lidBot', 'bend', 'slant', 'asym', 'ring', 'glow', 'warm', 'smile', 'mouthW', 'mouthO',
  'browY', 'browTilt', 'arm', 'wave', 'breath', 'zzz', 'pointer',
] as const satisfies readonly Channel3[]

const calm: T3 = {
  lean: 0, roll: 0, yaw: 0, head: 0, headRoll: 0, lift: 0, squash: 1, eyeW: 1, eyeH: 1, eyeY: 0, lookX: 0, lookY: 0,
  lidTop: 0.12, lidBot: 0, bend: 0, slant: 0, asym: 0, ring: 0, glow: 0.55, warm: 0, smile: 0.15, mouthW: 1, mouthO: 0,
  browY: 0, browTilt: 0, arm: 0, wave: 0, breath: 0.012, zzz: 0, pointer: 1,
}

// Every emotion moves at least three channel groups (eye shape, lid or brow angle, posture, light,
// tempo); `distinctGroups` in the tests counts them against idle.
export const targets3: Record<Emotion, T3> = {
  idle: calm,
  listening: { ...calm, lean: 0.12, roll: 0.1, headRoll: 0.12, head: 0.06, eyeH: 1.12, eyeW: 0.94, eyeY: 0.12, lidTop: 0, glow: 0.78, warm: 0.35, smile: 0.3, browY: 0.35, pointer: 1.15 },
  thinking: { ...calm, lean: -0.04, roll: -0.12, headRoll: -0.14, head: -0.2, lookX: -0.65, lookY: 0.7, eyeW: 0.88, lidTop: 0.3, slant: -0.25, asym: 0.55, glow: 0.62, warm: -0.45, smile: 0, mouthW: 0.6, browY: 0.2, browTilt: -0.35, pointer: 0.15, breath: 0.009 },
  happy: { ...calm, lean: -0.105, lift: 0.02, squash: 1.03, eyeY: 0.2, eyeH: 1.05, lidTop: 0, lidBot: 0.52, bend: 1, glow: 0.95, warm: 0.65, smile: 0.9, mouthW: 1.15, browY: 0.35, browTilt: 0.15, pointer: 0.4, breath: 0.016 },
  talking: { ...calm, lean: 0.05, roll: 0.04, eyeH: 1.02, lidTop: 0.05, glow: 0.72, warm: 0.2, smile: 0.25, browY: 0.2, pointer: 0.9, breath: 0.014 },
  surprised: { ...calm, lean: -0.08, lift: 0.05, squash: 1.06, head: -0.08, eyeW: 1.12, eyeH: 1.32, eyeY: 0.18, lidTop: 0, glow: 1, warm: 0.05, smile: 0, mouthW: 0.5, mouthO: 0.7, browY: 1, pointer: 0.4, breath: 0.008 },
  sorry: { ...calm, lean: 0.2, roll: 0.07, head: 0.24, headRoll: 0.1, lift: -0.02, squash: 0.97, eyeH: 0.72, eyeY: -0.35, lookY: -0.4, lidTop: 0.3, slant: 0.75, glow: 0.24, warm: -0.7, smile: -0.55, mouthW: 0.7, browY: 0.15, browTilt: 0.8, pointer: 0.2, breath: 0.015 },
  sleep: { ...calm, lean: 0.12, roll: 0.1, head: 0.26, headRoll: 0.12, lift: -0.02, squash: 0.95, eyeH: 0.1, eyeW: 0.85, eyeY: -0.25, lidTop: 0.55, glow: 0.14, warm: -0.35, smile: 0.05, mouthW: 0.6, browY: -0.3, zzz: 1, pointer: 0, breath: 0.022 },
  point: { ...calm, lean: 0.06, roll: -0.09, yaw: 0.34, headRoll: -0.05, lookX: 0.95, lookY: 0.05, eyeW: 1.06, lidTop: 0.04, slant: -0.12, glow: 0.74, warm: 0.15, smile: 0.35, browY: 0.25, browTilt: -0.15, arm: 1, pointer: 0.1 },
  wave: { ...calm, lean: -0.03, roll: 0.05, eyeY: 0.12, lidTop: 0, lidBot: 0.3, bend: 0.65, glow: 0.85, warm: 0.45, smile: 0.65, browY: 0.4, wave: 1, pointer: 0.6, breath: 0.014 },
}

// Breathing tempo in Hz: a calm 4.5 s breath at rest, slower when sorry or asleep, a touch quicker
// when happy or surprised. Nothing is a bounce.
export const tempo3: Record<Emotion, number> = {
  idle: 0.22, listening: 0.24, thinking: 0.2, happy: 0.27, talking: 0.25, surprised: 0.3, sorry: 0.18, sleep: 0.13, point: 0.22, wave: 0.25,
}

// Springs: settles, not jelly. [stiffness, zeta]; the surprised reaction uses `react` (faster).
export const feel3: Partial<Record<Channel3, [number, number]>> = {
  lean: [55, 0.78], roll: [55, 0.78], yaw: [50, 0.85], head: [60, 0.8], headRoll: [60, 0.8], lift: [50, 0.75],
  squash: [90, 0.6], eyeW: [120, 0.8], eyeH: [120, 0.78], lidTop: [110, 0.9], lidBot: [100, 0.9], bend: [100, 0.9],
  glow: [40, 1], warm: [30, 1], arm: [60, 0.8], wave: [40, 1], zzz: [20, 1],
}
export const REACT: [number, number] = [260, 0.55]
export const springFor = (c: Channel3, em: Emotion): [number, number] =>
  em === 'surprised' && (c === 'eyeH' || c === 'eyeW' || c === 'lift' || c === 'squash' || c === 'browY') ? REACT : feel3[c] ?? [80, 0.85]

// Blinks: every 3 to 6 s, 0.2 s; one in four is a double blink. r1, r2 random numbers in [0, 1).
export const BLINK3 = 0.2
export function nextBlink3(r1: number, r2: number): { delay: number; double: boolean } {
  const k = Math.min(Math.max(r1, 0), 0.999999)
  return { delay: 3 + 3 * k, double: r2 < 0.25 }
}
// How closed the eyes are t seconds into a (double) blink: 0 open, 1 shut.
export function blink3(t: number, double: boolean): number {
  const one = (u: number) => {
    if (u <= 0 || u >= BLINK3) return 0
    const tri = 1 - Math.abs((2 * u) / BLINK3 - 1)
    return tri * tri * (3 - 2 * tri)
  }
  return Math.max(one(t), double ? one(t - BLINK3 - 0.08) : 0)
}
export const blinkLen3 = (double: boolean) => (double ? BLINK3 * 2 + 0.08 : BLINK3)

// Face geometry per variant, in the units of the figure (the body or head height = `face`). eye: base
// half height of one eye. The rule from the brief: the full eye height stays under 12% of the face
// height even at the largest emotion (eyeH 1.32 surprised). Tested.
export const eyeSpec: Record<RoundThree, { face: number; eyeHalf: number; eyes: 1 | 2; note: string }> = {
  i: { face: 2.2, eyeHalf: 0.095, eyes: 2, note: 'body height, the pebble is the head' },
  j: { face: 1.04, eyeHalf: 0.042, eyes: 1, note: 'head height; the lens is larger, the iris light is the eye' },
  k: { face: 1.7, eyeHalf: 0.072, eyes: 2, note: 'body height, the screen square is the head' },
  l: { face: 0.92, eyeHalf: 0.04, eyes: 2, note: 'head height (head : body 1 : 1.8)' },
  m: { face: 2.0, eyeHalf: 0.07, eyes: 2, note: 'disc diameter; slit eyes' },
}
// The largest eye of a variant over every emotion (with its overrides), as a share of the face height.
export const maxEyeH = (v: RoundThree) => Math.max(...(Object.keys(targets3) as Emotion[]).map((e) => target3(v, e).eyeH * Math.max(1, target3(v, e).eyeW > 1 && eyeSpec[v].eyes === 1 ? target3(v, e).eyeW : 1)))
export const eyeShare = (v: RoundThree) => (2 * eyeSpec[v].eyeHalf * maxEyeH(v)) / eyeSpec[v].face

// Groups of channels used to prove emotions differ (see the matrix in docs/fira.md).
export const groups3: Record<string, Channel3[]> = {
  eyes: ['eyeW', 'eyeH', 'eyeY', 'lidBot', 'bend', 'ring', 'mouthO', 'asym'],
  angle: ['lidTop', 'slant', 'browTilt', 'browY', 'smile'],
  posture: ['lean', 'roll', 'yaw', 'head', 'headRoll', 'lift', 'squash', 'arm', 'wave'],
  light: ['glow', 'warm'],
}
export function distinctGroups(a: Emotion, b: Emotion = 'idle'): string[] {
  const out = Object.entries(groups3).filter(([, cs]) => cs.some((c) => Math.abs(targets3[a][c] - targets3[b][c]) > 0.04)).map(([g]) => g)
  if (Math.abs(tempo3[a] - tempo3[b]) > 0.015) out.push('tempo')
  return out
}

// The eye-light colour: lime pulled toward warm yellow (warm > 0) or cool mint (warm < 0). Hex in, hex
// out, pure so it is tested.
export function tintLight(accent: string, warm: number): string {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = hex(accent)
  const to = warm >= 0 ? [255, 236, 120] : [150, 255, 214]
  const k = Math.min(Math.abs(warm), 1) * 0.45
  return '#' + a.map((x, i) => Math.round(x + (to[i]! - x) * k).toString(16).padStart(2, '0')).join('')
}

// Per-variant tweaks on top of targets3. J has one eye, so its iris shape does more of the acting:
// a ring while listening, a half ring while talking, a small dot when sorry, a deeper squint thinking.
export const override3: Partial<Record<RoundThree, Partial<Record<Emotion, Partial<T3>>>>> = {
  j: {
    listening: { ring: 1, eyeH: 1.2, eyeW: 1.2 },
    talking: { ring: 0.55 },
    thinking: { lidTop: 0.42, slant: 0, lookX: -0.8 },
    sorry: { eyeW: 0.55, eyeH: 0.55, slant: 0 },
    point: { lookX: 1 },
    happy: { lidBot: 0.45 },
  },
  l: { thinking: { head: -0.32 }, listening: { lean: 0.16, head: 0.1 } },
  m: { sorry: { slant: 0.3 } },
  k: { sorry: { slant: 0.45, lidTop: 0.2, glow: 0.34 } },
}
export function target3(v: RoundThree, em: Emotion): T3 {
  const o = override3[v]?.[em]
  return o ? { ...targets3[em], ...o } : targets3[em]
}
