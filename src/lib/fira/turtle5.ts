// Round five (2026-11-23): the standing turtle, four variants on ONE rig that differ only by the
// signature detail. Pure maths and tables, free of three.js, so node tests cover them: rig proportions,
// detail flags, the tuned emotion targets, which shell segments glow for an emotion and a page context.
import { emotions, type Emotion } from './pose'
import { targets3, type T3 } from './pose3'

export const turtles5 = ['r', 's', 't', 'u'] as const
export type Turtle5 = (typeof turtles5)[number]
export const isTurtle5 = (v: unknown): v is Turtle5 => typeof v === 'string' && (turtles5 as readonly string[]).includes(v)

// What each variant wears. The rig, the face, the pearl and the motion are shared; only these differ.
export type Detail5 = { name: string; caption: string; glasses: boolean; headphones: boolean; segments: boolean; pearl: true; listen: 'adjust' | 'ear' | 'glow' }
export const detail5: Record<Turtle5, Detail5> = {
  r: { name: 'R «Очки»', caption: 'Круглые очки с бликом: вспыхивают, когда она думает, и поправляет их, когда слушает.', glasses: true, headphones: false, segments: false, pearl: true, listen: 'adjust' },
  s: { name: 'S «Наушники»', caption: 'Наушники на шее: когда слушает, одна чашка поднимается к уху.', glasses: false, headphones: true, segments: false, pearl: true, listen: 'ear' },
  t: { name: 'T «Лампы»', caption: 'Секции панциря светятся как лампы настроения: эмоция и страница красят одну-три из них.', glasses: false, headphones: false, segments: true, pearl: true, listen: 'glow' },
  u: { name: 'U «Очки и наушники»', caption: 'Очки и наушники на шее вместе: блик при раздумье, чашка к уху при слушании.', glasses: true, headphones: true, segments: false, pearl: true, listen: 'ear' },
}

// ---- Rig proportions (units of the scene; feet on y = 0, she faces +z) ----
// Standing: a pear body on two short legs, a round head sitting on the shoulders, a MEDIUM shell on the
// back (about nine tenths of the body height, 1.2 times its width, a hand deep behind it).
export const rig5 = {
  head: { r: 0.55, y: 2.18 },
  body: { rx: 0.55, ry: 0.68, rz: 0.5, y: 1.1 },
  shell: { rx: 0.7, ry: 0.64, rz: 0.52, y: 1.38, z: -0.5, tilt: -0.5 },
  leg: { x: 0.27, y: 0.7, r: 0.19 },
  arm: { x: 0.46, y: 1.58, len: 0.7, r: 0.12 },
  pearl: { r: 0.1 },
}
export const ratios5 = () => {
  const headH = rig5.head.r * 2, bodyH = rig5.body.ry * 2, shellH = rig5.shell.ry * 2
  return {
    headH, bodyH, shellH,
    headToBody: headH / bodyH,
    shellToBody: shellH / bodyH,
    shellWidthToBody: (rig5.shell.rx * 2) / (rig5.body.rx * 2),
    shellBehind: -rig5.body.rz - (rig5.shell.z - rig5.shell.rz), // how far the shell sticks out behind the body's back
    total: rig5.head.y + rig5.head.r,
    headToTotal: headH / (rig5.head.y + rig5.head.r),
  }
}

// ---- Face ----
// Eyes and brows carry the expression. One eye is at most 17% of the head height (round four: 12%).
export const EYE_HALF5 = 0.06
export const HEAD_H5 = 1.0
export const eyeShare5 = (maxEyeH: number) => (2 * EYE_HALF5 * maxEyeH) / HEAD_H5

// Round-three channels tuned for a chill know-it-all: half-lidded and calm at rest, brows clearly lifted
// or angled so every emotion reads at a glance.
const tweak: Partial<Record<Emotion, Partial<T3>>> = {
  idle: { lidTop: 0.16, smile: 0.28, browY: 0.12, browTilt: -0.1, asym: 0.12, lean: -0.03 },
  listening: { browY: 0.5, lidTop: 0.02 },
  thinking: { browY: 0.35, browTilt: -0.5, asym: 0.75 },
  happy: { browY: 0.45, smile: 1 },
  sorry: { browTilt: 1.1, browY: 0.1 },
  surprised: { browY: 1.2 },
}
export const targets5: Record<Emotion, T3> = Object.fromEntries(emotions.map((e) => [e, { ...targets3[e], ...tweak[e] }])) as Record<Emotion, T3>

// How long the signature moves last and how they are timed per emotion. flash: lens glints.
export const flash5 = (emotion: Emotion, t: number): number =>
  emotion === 'thinking' ? 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 3.1)), 5) : emotion === 'surprised' ? 0.6 : emotion === 'happy' ? 0.35 : 0.12
// 0..1: how far the headphone cup has lifted to the ear, and how far the hand is at the glasses.
export const earLift5 = (v: Turtle5, emotion: Emotion): number => (detail5[v].headphones && emotion === 'listening' ? 1 : 0)
export const adjustLift5 = (v: Turtle5, emotion: Emotion): number => (detail5[v].listen === 'adjust' && emotion === 'listening' ? 1 : 0)

// ---- Shell lamps (variant T): eleven segments in three rings ----
export type Tint = 'lime' | 'mint' | 'amber' | 'rose' | 'dim'
export const tintHex: Record<Tint, string> = { lime: '#c6ff3d', mint: '#7ae8c9', amber: '#ffb23d', rose: '#ff8fa3', dim: '#5b7a4a' }
export type SegGlow = { seg: number; tint: Tint; amt: number }
export const SEGMENTS = 11
// Eleven scutes: 0 the crown, 1 to 5 the inner ring, 6 to 10 the outer ring. Seen from the front three
// quarters the visible ones are 2 (the big inner one), 7 and 8 (the outer pair), a sliver of 0 and 3, so
// the tables below spend those: the emotion takes 2 and 7, the page context takes 8.
const emotionLamps: Record<Emotion, SegGlow[]> = {
  idle: [{ seg: 2, tint: 'lime', amt: 0.3 }],
  listening: [{ seg: 2, tint: 'mint', amt: 0.7 }, { seg: 7, tint: 'mint', amt: 0.45 }],
  thinking: [{ seg: 7, tint: 'mint', amt: 0.85 }, { seg: 2, tint: 'mint', amt: 0.5 }],
  happy: [{ seg: 2, tint: 'lime', amt: 0.9 }, { seg: 7, tint: 'amber', amt: 0.65 }],
  talking: [{ seg: 7, tint: 'lime', amt: 0.75 }],
  surprised: [{ seg: 2, tint: 'amber', amt: 1 }, { seg: 7, tint: 'amber', amt: 0.7 }],
  sorry: [{ seg: 7, tint: 'rose', amt: 0.6 }],
  sleep: [{ seg: 2, tint: 'dim', amt: 0.3 }],
  point: [{ seg: 7, tint: 'lime', amt: 0.75 }],
  wave: [{ seg: 2, tint: 'lime', amt: 0.8 }, { seg: 7, tint: 'amber', amt: 0.55 }],
}
// The page context (ids of contexts.ts) adds one lamp of its own, always segment 8, tinted by the page.
export const ctxLamp: Record<string, { seg: number; tint: Tint }> = {
  home: { seg: 8, tint: 'lime' }, products: { seg: 8, tint: 'amber' }, builder: { seg: 8, tint: 'mint' }, chat: { seg: 8, tint: 'mint' },
  telegram: { seg: 8, tint: 'amber' }, docs: { seg: 8, tint: 'lime' }, cabinet: { seg: 8, tint: 'lime' }, '404': { seg: 8, tint: 'rose' },
}
// One to three lit segments: the emotion's own (up to two) plus the context's, never the same twice.
export function segmentGlow(emotion: Emotion, ctxId?: string): SegGlow[] {
  const out = emotionLamps[emotion].slice(0, 2).map((g) => ({ ...g }))
  const c = ctxId ? ctxLamp[ctxId] : undefined
  if (c) {
    const at = out.findIndex((g) => g.seg === c.seg)
    if (at >= 0) out[at] = { seg: c.seg, tint: c.tint, amt: Math.max(out[at]!.amt, 0.55) }
    else out.push({ seg: c.seg, tint: c.tint, amt: 0.55 })
  }
  return out.slice(0, 3)
}

// Behaviour numbers shared by the four (one rig): a slow breath, lazy blinks, long fidget gaps.
export const feel5 = { tempo: 0.9, blink: [3.5, 6.5] as [number, number], double: 0.2, gaze: 0.9, fidget: [9, 16] as [number, number] }
