import {
  BufferGeometry, CapsuleGeometry, CircleGeometry, LatheGeometry, PlaneGeometry, SphereGeometry, TorusGeometry,
  Vector2, type ShaderMaterial,
} from 'three'
import type { Variant } from '@/lib/fira/pose'
import { ballProfile, profileOf, type Profile } from './fira-kit'
import { blobMaterial, clayMaterial, eyeMaterial, lidMaterial, mouthMaterial, uni } from './materials'

// Round two (D to H): everything one Fira needs, built once per variant. Five silhouettes on one rig.
// Units: the ground is y = 0, a figure is about 2.2 to 2.7 tall before `scale` (which fits it to the
// frame). Profiles are lathe curves; faces are decals placed on them (see fira-face.tsx).

export type FaceLayout = {
  profile: Profile
  eye: { x: number; y: number; s: number; aspect: number }
  mouthY: number
  mouthS: number
  cheek: { x: number; y: number; k: number }
  lift: number
  lidBias: number
  lidTilt: number
  browLift: number
  /** How much of the surprised wide-eye scale this face can take (the flame head is narrow). */
  wideK: number
  order: number
}
export type Spec2 = { scale: number; face: FaceLayout; zz: [number, number]; shadow: number }

const pts = (list: [number, number][]) => list.map(([r, y]) => new Vector2(Math.max(r, 0), y))
const bez = (a: number[], b: number[], c: number[], d: number[], n: number): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
    return [k[0]! * a[0]! + k[1]! * b[0]! + k[2]! * c[0]! + k[3]! * d[0]!, k[0]! * a[1]! + k[1]! * b[1]! + k[2]! * c[1]! + k[3]! * d[1]!]
  })

function profileFrom(points: [number, number][]): Profile {
  const v = pts(points)
  const at = (y: number) => {
    for (let i = 1; i < v.length; i++) {
      if (v[i]!.y >= y) {
        const a = v[i - 1]!, b = v[i]!
        const k = (y - a.y) / Math.max(b.y - a.y, 1e-6)
        return [a.x + (b.x - a.x) * k, (b.x - a.x) / Math.max(b.y - a.y, 1e-6)] as const
      }
    }
    return [0, 0] as const
  }
  return { pts: v, r: (y) => at(y)[0], dr: (y) => at(y)[1], top: v[v.length - 1]!.y }
}

// D: a flame head. A round bulb (radius .52) and a tip that tapers in a concave curve; the shader bends
// the tip sideways. y runs 0 (bottom) to FLAME_H (tip).
export const FLAME_R = 0.58
export const FLAME_H = 1.7
export const flameProfile = (() => {
  const out: [number, number][] = [[0, 0]]
  for (let i = 1; i <= 22; i++) {
    const th = -Math.PI / 2 + (i / 22) * (Math.PI / 2 + Math.PI / 6)
    out.push([FLAME_R * Math.cos(th), FLAME_R + FLAME_R * Math.sin(th)])
  }
  const tip = bez([0.502, 0.87], [0.42, 1.12], [0.16, 1.4], [0.0, FLAME_H], 30)
  tip.shift()
  return profileFrom([...out, ...tip])
})()

// E: a seed. Wide round bottom, narrower dome, height 1.9.
export const SEED_H = 1.9
export const seedProfile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  const r = 0.93 * Math.pow(Math.sin(t), 0.82) * (1.1 - 0.34 * u)
  return [r, u * SEED_H]
}, 90)

// G: a drop with a blunt dome, wide at the bottom, height 1.9.
export const DROP_H = 1.9
export const catDropProfile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  const r = 0.98 * Math.pow(Math.sin(t), 0.78) * (1.12 - 0.46 * Math.pow(u, 1.3))
  return [r, u * DROP_H]
}, 100)

// F: a small pear body.
export const pearProfile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  return [0.52 * Math.pow(Math.sin(t), 0.9) * (1.08 - 0.3 * u), u * 1.05]
}, 60)

// A soft pointed ear or leaf, base at y 0, tip at y 1.
const petalProfile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  return [0.5 * Math.pow(Math.sin(t), 0.95) * (1 - 0.45 * u), u]
}, 30)

export const specs2: Record<'d' | 'e' | 'f' | 'g' | 'h', Spec2> = {
  d: {
    scale: 1.12,
    face: { profile: flameProfile, eye: { x: 0.225, y: 0.6, s: 0.28, aspect: 0.92 }, mouthY: 0.26, mouthS: 0.25, cheek: { x: 0.41, y: 0.34, k: 0.8 }, lift: 0.012, lidBias: 0, lidTilt: 0, browLift: 0.5, wideK: 0.45, order: 3 },
    zz: [0.55, 1.9], shadow: 0.95,
  },
  e: {
    scale: 1.14,
    face: { profile: seedProfile, eye: { x: 0.36, y: 1.02, s: 0.285, aspect: 1, }, mouthY: 0.62, mouthS: 0.26, cheek: { x: 0.64, y: 0.78, k: 0.9 }, lift: 0.012, lidBias: 0.3, lidTilt: -0.25, browLift: 0.45, wideK: 1, order: 3 },
    zz: [0.95, 1.9], shadow: 1.1,
  },
  f: {
    scale: 1.28,
    face: { profile: ballProfile, eye: { x: 0.34, y: 0.02, s: 0.27, aspect: 1.02 }, mouthY: -0.36, mouthS: 0.25, cheek: { x: 0.64, y: -0.2, k: 1 }, lift: 0.012, lidBias: 0.04, lidTilt: 0, browLift: 0.5, wideK: 1, order: 3 },
    zz: [1.0, 2.0], shadow: 0.95,
  },
  g: {
    scale: 1.14,
    face: { profile: catDropProfile, eye: { x: 0.36, y: 0.98, s: 0.275, aspect: 0.95 }, mouthY: 0.58, mouthS: 0.25, cheek: { x: 0.66, y: 0.74, k: 0.9 }, lift: 0.012, lidBias: 0, lidTilt: 0, browLift: 0.5, wideK: 1, order: 3 },
    zz: [0.9, 2.0], shadow: 1.15,
  },
  h: {
    scale: 1.3,
    face: { profile: ballProfile, eye: { x: 0.33, y: 0.06, s: 0.28, aspect: 1, }, mouthY: -0.34, mouthS: 0.25, cheek: { x: 0.6, y: -0.18, k: 0.9 }, lift: 0.01, lidBias: 0, lidTilt: 0, browLift: 0.5, wideK: 1, order: 1 },
    zz: [1.05, 2.0], shadow: 1.1,
  },
}

export function makeKit2(variant: Variant) {
  const geo: BufferGeometry[] = []
  const g = <T extends BufferGeometry>(x: T) => (geo.push(x), x)

  const body = clayMaterial({ rim: 0.34, spec: 0.1, sss: 0.45 })
  const flame = clayMaterial({ rim: 0.34, spec: 0.1, sss: 0.45, bend: 0.1, bendY: 0.7, tipY: 0.85, tipAmt: 0.75 })
  const deep = clayMaterial({ rim: 0.2, spec: 0.08, sss: 0.3 })
  const ink = clayMaterial({ rim: 0.05, spec: 0.2, sss: 0 })
  const cream = clayMaterial({ rim: 0, spec: 0.1, sss: 0.1 })
  const dot = clayMaterial({ rim: 0.1, spec: 0.1, glow: 0.18, sss: 0 })
  const shell = clayMaterial({ rim: 0.7, rimPow: 2.2, spec: 0.2, opacity: 1, alphaRim: 0.82, sss: 0.2, edge: 0.55 })
  const eye = eyeMaterial()
  const lidL = lidMaterial(-1), lidR = lidMaterial(1)
  const mouth = mouthMaterial()
  const blush = blobMaterial()
  const shadow = blobMaterial()
  const shadow2 = blobMaterial()
  const halo = blobMaterial()
  const belly = blobMaterial()
  const hl = blobMaterial()
  const f = specs2[variant as keyof typeof specs2]
  uni(eye).uAspect!.value = f.face.eye.aspect
  uni(lidL).uAspect!.value = f.face.eye.aspect
  uni(lidR).uAspect!.value = f.face.eye.aspect
  uni(belly).uSoft!.value = 0.55
  uni(hl).uSoft!.value = 0.5
  const zMats = [0, 1, 2].map(() => clayMaterial({ rim: 0, spec: 0, opacity: 0.999, sss: 0 }))
  zMats.forEach((m) => (m.transparent = true))
  const all: ShaderMaterial[] = [body, flame, deep, ink, cream, dot, shell, eye, lidL, lidR, mouth, blush, shadow, shadow2, halo, belly, hl, ...zMats]

  const limb = (len: number, r: number) => g(new CapsuleGeometry(r, len, 8, 14).rotateZ(-Math.PI / 2).translate(len / 2 + r * 0.4, 0, 0))
  const lathe = (p: Profile) => g(new LatheGeometry(p.pts, 72))
  const R = 1
  const browG = g(new TorusGeometry(R, 0.13, 8, 22, 1.2).rotateZ(Math.PI / 2 - 0.6).translate(0, -0.91 * R, 0))
  const geos = {
    ball: g(new SphereGeometry(1, 64, 48)),
    // Small parts (feet, tail, ears, dots) do not need the high-poly sphere.
    low: g(new SphereGeometry(1, 28, 18)),
    flame: lathe(flameProfile),
    seed: lathe(seedProfile),
    catDrop: lathe(catDropProfile),
    pear: lathe(pearProfile),
    petal: g(new LatheGeometry(petalProfile.pts, 40)),
    plane: g(new PlaneGeometry(2, 2)),
    disc: g(new CircleGeometry(1, 40)),
    brow: browG,
    arm: { d: limb(0.34, 0.1), e: limb(0.34, 0.1), f: limb(0.36, 0.12), g: limb(0.32, 0.1), h: limb(0.28, 0.09) },
    zbar: g(new CapsuleGeometry(0.032, 0.2, 6, 10).rotateZ(Math.PI / 2)),
    zdiag: g(new CapsuleGeometry(0.032, 0.27, 6, 10).rotateZ(-0.65)),
  }
  return {
    variant, spec: f, geos,
    mats: { body, flame, deep, ink, cream, dot, shell },
    eye, lidL, lidR, mouth, blush, shadow, shadow2, halo, belly, hl, zMats, all,
    dispose() {
      geo.forEach((x) => x.dispose())
      all.forEach((m) => m.dispose())
    },
  }
}
export type Kit2 = ReturnType<typeof makeKit2>
