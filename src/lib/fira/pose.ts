// Fira's pose maths, free of three.js so it is tested in node: emotion targets, springs, blink
// timing, the hop curve and the pointer limits. The rig (components/fira/fira-scene.tsx) steps one
// spring per channel toward the target of the current emotion and writes the result to the meshes.

export const emotions = ['idle', 'thinking', 'happy', 'talking', 'point', 'sleep', 'wave', 'surprised'] as const
export type Emotion = (typeof emotions)[number]

// a-c: round one (spheres with faces, kept for comparison). d-h: round two, the improved rig.
export const variants = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export type RoundOne = 'a' | 'b' | 'c'
export const roundTwo = ['d', 'e', 'f', 'g', 'h'] as const
export const isRoundTwo = (v: Variant) => (roundTwo as readonly string[]).includes(v)
export type Variant = (typeof variants)[number]

export function isEmotion(v: unknown): v is Emotion {
  return typeof v === 'string' && (emotions as readonly string[]).includes(v)
}
export function isVariant(v: unknown): v is Variant {
  return typeof v === 'string' && (variants as readonly string[]).includes(v)
}

// One number per channel. Angles are radians. squash is the base height scale (breathing and hops
// ride on top). moon: +1 happy arches, -1 sleepy arches, 0 open eyes. arm/cheer are 0..1.
export type Targets = {
  pitch: number
  roll: number
  lean: number
  squash: number
  open: number
  moon: number
  smile: number
  blush: number
  arm: number
  cheer: number
  lookX: number
  lookY: number
  glow: number
  ear: number
  earSplit: number
  breath: number
  hop: number
  zzz: number
  pointer: number
  // Round two face and body channels: brows (lift, tilt, one raised), upper lid and its tilt, wide
  // eyes, open grin, round surprised mouth, the wave arm, tail curl, waddle amount.
  browY: number
  browTilt: number
  browSplit: number
  lid: number
  lidTilt: number
  wide: number
  grin: number
  mouthO: number
  wave: number
  tail: number
  waddle: number
}
export type Channel = keyof Targets
export const channels: Channel[] = [
  'pitch', 'roll', 'lean', 'squash', 'open', 'moon', 'smile', 'blush', 'arm', 'cheer',
  'lookX', 'lookY', 'glow', 'ear', 'earSplit', 'breath', 'hop', 'zzz', 'pointer',
  'browY', 'browTilt', 'browSplit', 'lid', 'lidTilt', 'wide', 'grin', 'mouthO', 'wave', 'tail', 'waddle',
]

const calm: Targets = {
  pitch: 0, roll: 0, lean: 0, squash: 1, open: 1, moon: 0, smile: 0.4, blush: 0.25, arm: 0, cheer: 0,
  lookX: 0, lookY: 0, glow: 0.3, ear: 0, earSplit: 0, breath: 0.022, hop: 0, zzz: 0, pointer: 1,
  browY: 0, browTilt: 0, browSplit: 0, lid: 0, lidTilt: 0, wide: 1, grin: 0, mouthO: 0, wave: 0, tail: 0.55, waddle: 0.15,
}

export const targets: Record<Emotion, Targets> = {
  idle: calm,
  thinking: { ...calm, pitch: -0.2, roll: 0.2, lookX: -0.55, lookY: 0.75, smile: 0.1, glow: 1, pointer: 0.2, ear: 0.55, earSplit: 0.6, breath: 0.016, browSplit: 1, browY: 0.3, lid: 0.14, lidTilt: 0.3, tail: 0.1, waddle: 0 },
  happy: { ...calm, pitch: 0.04, open: 1, moon: 1, smile: 1, blush: 1, cheer: 1, hop: 1, glow: 0.7, ear: 1, pointer: 0.3, breath: 0.03, grin: 0.85, browY: 0.55, browTilt: -0.25, tail: 1, waddle: 0.9 },
  talking: { ...calm, smile: 0.15, blush: 0.35, glow: 0.5, ear: 0.3, pointer: 0.9, browY: 0.25, tail: 0.5, waddle: 0.3 },
  point: { ...calm, lean: 0.22, roll: -0.12, arm: 1, lookX: 0.8, lookY: 0.1, smile: 0.55, pointer: 0.1, ear: 0.4, glow: 0.45, browY: 0.25, waddle: 0 },
  sleep: { ...calm, pitch: 0.26, roll: 0.1, squash: 0.94, open: 0, moon: -1, smile: 0.15, blush: 0.55, glow: 0.04, ear: -1, breath: 0.05, zzz: 1, pointer: 0, browY: -0.45, browTilt: -0.3, tail: 0.25, waddle: 0 },
  wave: { ...calm, pitch: 0.05, roll: -0.08, smile: 0.9, blush: 0.7, wave: 1, glow: 0.65, ear: 0.9, pointer: 0.6, browY: 0.5, browTilt: -0.2, grin: 0.35, tail: 0.8, waddle: 0.5, breath: 0.03 },
  surprised: { ...calm, pitch: -0.06, squash: 1.07, smile: 0, blush: 0.2, wide: 1.28, browY: 1, browTilt: -0.15, mouthO: 0.62, glow: 0.95, ear: 1, pointer: 0.45, cheer: 0.15, arm: 0.2, tail: 1, waddle: 0, breath: 0.012 },
}

// Breathing rate in Hz per emotion (a calm in-out every 3 s, slower asleep).
export const breathHz: Record<Emotion, number> = {
  idle: 0.33, thinking: 0.28, happy: 0.7, talking: 0.45, point: 0.35, sleep: 0.16, wave: 0.6, surprised: 0.5,
}

export type Spring = { x: number; v: number }
export const makeSprings = (from: Targets): Record<Channel, Spring> =>
  Object.fromEntries(channels.map((c) => [c, { x: from[c], v: 0 }])) as Record<Channel, Spring>

// Damped spring toward a target, substepped at 120 Hz so a long frame cannot blow it up. zeta 1 is
// critically damped (no overshoot), lower bounces.
export function stepSpring(s: Spring, target: number, dt: number, stiffness = 140, zeta = 0.8): number {
  const c = 2 * zeta * Math.sqrt(stiffness)
  const n = Math.max(1, Math.ceil(dt * 120))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    s.v += (-stiffness * (s.x - target) - c * s.v) * h
    s.x += s.v * h
  }
  return s.x
}

// Per-channel feel: jelly body, soft limbs, calm head.
export const feel: Partial<Record<Channel, [number, number]>> = {
  squash: [240, 0.42],
  arm: [170, 0.55],
  cheer: [170, 0.5],
  lean: [120, 0.7],
  ear: [150, 0.45],
  earSplit: [150, 0.6],
  pitch: [110, 0.8],
  roll: [110, 0.7],
  wave: [190, 0.55],
  tail: [90, 0.4],
  wide: [260, 0.5],
  browY: [230, 0.55],
  browTilt: [200, 0.6],
  lid: [220, 0.7],
}

// Blink: every 3 to 6 seconds, 0.18 s long. r is a random number in [0, 1).
export const blinkDelay = (r: number) => 3 + 3 * Math.min(Math.max(r, 0), 0.999999)
export const BLINK_LEN = 0.18
// How closed the eyes are t seconds into a blink: 0 open, 1 shut, smooth both ways.
export function blinkClosed(t: number): number {
  if (t <= 0 || t >= BLINK_LEN) return 0
  const tri = 1 - Math.abs((2 * t) / BLINK_LEN - 1)
  return tri * tri * (3 - 2 * tri)
}

// A happy hop every 1.1 s: crouch, stretch in the air, squash on landing. y in world units, sy is
// the height scale the squash spring chases.
export const HOP_PERIOD = 1.1
export function hopCurve(t: number): { y: number; sy: number } {
  const p = (((t % HOP_PERIOD) + HOP_PERIOD) % HOP_PERIOD) / HOP_PERIOD
  if (p < 0.16) return { y: 0, sy: 1 - 0.16 * Math.sin((Math.PI * p) / 0.16) }
  if (p < 0.72) {
    const u = (p - 0.16) / 0.56
    return { y: 4 * u * (1 - u), sy: 1 + 0.12 * Math.abs(1 - 2 * u) }
  }
  const w = (p - 0.72) / 0.28
  return { y: 0, sy: 1 - 0.14 * Math.sin(Math.PI * w) * (1 - w) }
}

// The pointer's offset from the figure's centre, in figure sizes, limited to a unit disc-ish box so
// the eyes never roll out of the face.
export function clampLook(dx: number, dy: number, range = 1.6): { x: number; y: number } {
  const k = (v: number) => Math.max(-1, Math.min(1, v / range))
  return { x: k(dx), y: k(dy) }
}

// Squash and stretch keeps the volume: height s, width and depth 1 / sqrt(s).
export const volumeXZ = (sy: number) => 1 / Math.sqrt(Math.max(sy, 0.2))

// Mouth shapes for lip-sync (round two). Five visemes: closed, ee (wide and thin), oh (small round),
// ah (open), big (wide open). amp 0..1 picks and blends the shape, phase (seconds, any rate) swaps
// oh and ah in the middle so speech does not look like a pump. w and h are half sizes of the open
// mouth in the mouth decal (0..1), tongue shows on wide shapes.
export type Viseme = { name: 'closed' | 'ee' | 'oh' | 'ah' | 'big'; open: number; w: number; h: number; tongue: number }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export function visemeAt(amp: number, phase = 0): Viseme {
  const a = Math.min(Math.max(Number.isFinite(amp) ? amp : 0, 0), 1)
  const k = 0.5 + 0.5 * Math.sin(phase)
  const open = Math.min(1, a * 7)
  if (a < 0.04) return { name: 'closed', open, w: 0.8, h: 0.05, tongue: 0 }
  if (a < 0.2) return { name: 'ee', open, w: 0.9, h: lerp(0.08, 0.22, (a - 0.04) / 0.16), tongue: 0 }
  if (a < 0.6) {
    const u = (a - 0.2) / 0.4
    const oh = { w: 0.5, h: 0.5 }, ah = { w: 0.72, h: 0.58 }
    const w = lerp(0.9, lerp(oh.w, ah.w, k), Math.min(1, u * 2.2))
    const h = lerp(0.22, lerp(oh.h, ah.h, k), Math.min(1, u * 2.2)) + u * 0.12
    return { name: k < 0.5 ? 'oh' : 'ah', open: 1, w, h, tongue: u * 0.6 * k }
  }
  const u = (a - 0.6) / 0.4
  return { name: 'big', open: 1, w: lerp(0.74, 0.86, u), h: lerp(0.72, 1, u), tongue: 0.5 + 0.5 * u }
}

// The whole mouth from the emotion (smile arc, open grin, round O) and the voice: whichever is more
// open wins, so a grin never fights the lip-sync. smile is the closed arc depth 0..1.
export type MouthShape = { open: number; w: number; h: number; tongue: number; smile: number; flat: number }
export function mouthShape(smile: number, grin: number, mouthO: number, amp: number, phase: number): MouthShape {
  const talk = visemeAt(amp, phase)
  const g = Math.min(Math.max(grin, 0), 1), o = Math.min(Math.max(mouthO, 0), 1)
  const best = Math.max(talk.open, g, o)
  let shape: MouthShape
  if (best <= 0.02) shape = { open: 0, w: 0.8, h: 0.05, tongue: 0, smile, flat: 0 }
  else if (talk.open >= g && talk.open >= o) shape = { open: talk.open, w: talk.w, h: talk.h, tongue: talk.tongue, smile, flat: 0 }
  else if (g >= o) shape = { open: g, w: 0.88, h: 0.5, tongue: 0.7, smile, flat: 1 }
  else shape = { open: o, w: 0.42, h: 0.58, tongue: 0.25, smile, flat: 0 }
  return shape
}
