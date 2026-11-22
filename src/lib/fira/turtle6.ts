// Round six (2026-11-23): the owner's verdict on round five turned into numbers. One rig, four variants
// V W X Y that differ only by the signature accessories (headphones on the head or the neck, glasses, a
// small laptop). Pure maths and tables, free of three.js, so node tests cover them.
import { emotions, type Emotion } from './pose'
import { targets3, type T3 } from './pose3'
import { ctxLamp, tintHex, type Tint } from './turtle5'

export const turtles6 = ['v', 'w', 'x', 'y'] as const
export type Turtle6 = (typeof turtles6)[number]
export const isTurtle6 = (v: unknown): v is Turtle6 => typeof v === 'string' && (turtles6 as readonly string[]).includes(v)

// Everything every variant has: lime pearl on the shell, blush, a small tail, three claws per hand and foot,
// no belly plate. Only the accessories differ.
export type Detail6 = {
  name: string
  caption: string
  glasses: boolean
  headphones: 'head' | 'neck' | null
  laptop: boolean
  pearl: true
  blush: true
  tail: true
  belly: false
  claws: 3
}
const common = { pearl: true, blush: true, tail: true, belly: false, claws: 3 } as const
export const detail6: Record<Turtle6, Detail6> = {
  v: { name: 'V «Наушники и ноутбук»', caption: 'Наушники на голове с дужкой и мягкими амбушюрами, маленький ноутбук: под мышкой, когда спокойна, раскрыт, когда думает или говорит.', glasses: false, headphones: 'head', laptop: true, ...common },
  w: { name: 'W «Очки, наушники на шее, ноутбук»', caption: 'Очки, наушники на шее и ноутбук. На слушании одна чашка поднимается к уху, экран светится цветом страницы.', glasses: true, headphones: 'neck', laptop: true, ...common },
  x: { name: 'X «Очки и ноутбук»', caption: 'Только очки и маленький ноутбук. Очки вспыхивают, когда она думает.', glasses: true, headphones: null, laptop: true, ...common },
  y: { name: 'Y «Только наушники»', caption: 'Наушники на голове и ничего больше: на слушании она прижимает чашку рукой.', glasses: false, headphones: 'head', laptop: false, ...common },
}

// ---- Rig proportions (units of the scene; feet on y = 0, she faces +z) ----
// Round five read as a big blobby head («Лунтик»): the head is now about 32% of the height, the body a
// rounder-not-balloon pear, the shell a THIN plate hugging the back (depth a quarter of the body width).
export const rig6 = {
  head: { r: 0.4, y: 2.03 },
  body: { rx: 0.6, ry: 0.72, rz: 0.5, y: 0.98 },
  shell: { rx: 0.84, ry: 0.66, rz: 0.14, y: 1.22, z: -0.58, tilt: -0.12 },
  leg: { x: 0.26, y: 0.66, len: 0.6 },
  arm: { x: 0.47, y: 1.46, len: 0.66 },
  tail: { y: 0.46, z: -0.48 },
  pearl: { r: 0.085 },
  claw: { r: 0.032, len: 0.1 },
}
export const ratios6 = () => {
  const headH = rig6.head.r * 2, bodyH = rig6.body.ry * 2, bodyW = rig6.body.rx * 2
  const total = rig6.head.y + rig6.head.r
  return {
    headH, bodyH, bodyW, total,
    headToTotal: headH / total,
    shellDepthToBodyW: (rig6.shell.rz * 2) / bodyW,
    shellWidthToBody: (rig6.shell.rx * 2) / bodyW,
    shellToBody: (rig6.shell.ry * 2) / bodyH,
    // how far the shell's front face sinks into the body's back (0: just touching, never a gap)
    shellOverlap: rig6.shell.z + rig6.shell.rz + rig6.body.rz,
  }
}

// ---- Face: bigger round pupils with two highlights, soft lower lids, a small smile, expressive brows ----
export const EYE_HALF6 = 0.088
export const eyeShare6 = (maxEyeH: number) => (2 * EYE_HALF6 * maxEyeH) / 1.0

const tweak: Partial<Record<Emotion, Partial<T3>>> = {
  idle: { lidTop: 0.03, lidBot: 0.05, smile: 0.5, browY: 0.12, browTilt: -0.05, asym: 0.06, lean: -0.02, pointer: 1 },
  listening: { browY: 0.55, lidTop: 0, lidBot: 0.06, smile: 0.4 },
  thinking: { browY: 0.4, browTilt: -0.55, asym: 0.7, lidBot: 0.08 },
  happy: { browY: 0.5, smile: 1, lidBot: 0.5 },
  sorry: { browTilt: 1.1, browY: 0.1, lidBot: 0.15 },
  surprised: { browY: 1.2, lidBot: 0 },
}
export const targets6: Record<Emotion, T3> = Object.fromEntries(emotions.map((e) => [e, { ...targets3[e], ...tweak[e] }])) as Record<Emotion, T3>

// ---- Laptop: closed under the arm at rest, open on thinking and talking, the screen takes the page colour ----
export const laptopOpen6 = (v: Turtle6, emotion: Emotion): number => (detail6[v].laptop && (emotion === 'thinking' || emotion === 'talking') ? 1 : 0)
export const screenTint6 = (ctxId?: string): Tint => (ctxId ? ctxLamp[ctxId]?.tint : undefined) ?? 'lime'
export const screenHex6 = (ctxId: string | undefined, accent: string) => {
  const t = screenTint6(ctxId)
  return t === 'lime' ? accent : tintHex[t]
}
// Headphones: 0..1 how far a cup is lifted (neck variant) or pressed by the hand (head variant) while she listens.
export const cupLift6 = (v: Turtle6, emotion: Emotion): number => (detail6[v].headphones && emotion === 'listening' ? 1 : 0)
export const lensFlash6 = (emotion: Emotion, t: number): number =>
  emotion === 'thinking' ? 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 3.1)), 5) : emotion === 'surprised' ? 0.6 : emotion === 'happy' ? 0.35 : 0.12

// ---- Turning: the whole body follows the pointer, otherwise a slow look-around cycle ----
export const BASE_YAW6 = 0.14 // front three-quarter: toward the viewer, a little to the side so the shell shows
export const YAW_MAX6 = 0.95
// Where the body wants to face (radians, around BASE_YAW6). Pointer x in -1..1 while it moved lately;
// otherwise the slow cycle: about 14 s per sweep, at most 0.55 rad each way, calm.
export function bodyYaw6(pointerX: number, pointerAge: number, clock: number, follow: boolean): number {
  const cycle = Math.sin(clock * 0.45) * 0.38 + Math.sin(clock * 0.23) * 0.16
  const fresh = follow ? Math.min(1, Math.max(0, 1 - (pointerAge - 4) / 3)) : 0
  const look = pointerX * 0.8
  return BASE_YAW6 + (cycle * (1 - fresh) + look * fresh)
}
export const feel6 = { tempo: 0.9, blink: [3.2, 6] as [number, number], double: 0.2, gaze: 0.95, fidget: [6, 11] as [number, number] }
