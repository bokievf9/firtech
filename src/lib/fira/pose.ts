// Fira's pose maths, free of three.js so it is tested in node: emotion targets, springs, blink
// timing, the hop curve and the pointer limits. The rig (components/fira/fira-scene.tsx) steps one
// spring per channel toward the target of the current emotion and writes the result to the meshes.

export const emotions = ['idle', 'thinking', 'happy', 'talking', 'point', 'sleep'] as const
export type Emotion = (typeof emotions)[number]

export const variants = ['a', 'b', 'c'] as const
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
}
export type Channel = keyof Targets
export const channels: Channel[] = [
  'pitch', 'roll', 'lean', 'squash', 'open', 'moon', 'smile', 'blush', 'arm', 'cheer',
  'lookX', 'lookY', 'glow', 'ear', 'earSplit', 'breath', 'hop', 'zzz', 'pointer',
]

const calm: Targets = {
  pitch: 0, roll: 0, lean: 0, squash: 1, open: 1, moon: 0, smile: 0.4, blush: 0.25, arm: 0, cheer: 0,
  lookX: 0, lookY: 0, glow: 0.3, ear: 0, earSplit: 0, breath: 0.022, hop: 0, zzz: 0, pointer: 1,
}

export const targets: Record<Emotion, Targets> = {
  idle: calm,
  thinking: { ...calm, pitch: -0.2, roll: 0.2, lookX: -0.55, lookY: 0.75, smile: 0.1, glow: 1, pointer: 0.2, ear: 0.55, earSplit: 0.6, breath: 0.016 },
  happy: { ...calm, pitch: 0.04, open: 1, moon: 1, smile: 1, blush: 1, cheer: 1, hop: 1, glow: 0.7, ear: 1, pointer: 0.3, breath: 0.03 },
  talking: { ...calm, smile: 0.15, blush: 0.35, glow: 0.5, ear: 0.3, pointer: 0.9 },
  point: { ...calm, lean: 0.22, roll: -0.12, arm: 1, lookX: 0.8, lookY: 0.1, smile: 0.55, pointer: 0.1, ear: 0.4, glow: 0.45 },
  sleep: { ...calm, pitch: 0.26, roll: 0.1, squash: 0.94, open: 0, moon: -1, smile: 0.15, blush: 0.55, glow: 0.04, ear: -1, breath: 0.05, zzz: 1, pointer: 0 },
}

// Breathing rate in Hz per emotion (a calm in-out every 3 s, slower asleep).
export const breathHz: Record<Emotion, number> = {
  idle: 0.33, thinking: 0.28, happy: 0.7, talking: 0.45, point: 0.35, sleep: 0.16,
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
