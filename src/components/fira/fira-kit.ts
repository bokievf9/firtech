import {
  CapsuleGeometry, CircleGeometry, IcosahedronGeometry, LatheGeometry, Object3D, PlaneGeometry,
  Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry, type ShaderMaterial,
} from 'three'
import type { Variant } from '@/lib/fira/pose'
import { blobMaterial, eyeMaterial, softMaterial } from './materials'

// Everything one Fira needs, built once per variant: body profile, geometries and materials. Pure
// geometry, no textures. Shapes differ per variant, the rig (fira-scene.tsx) is the same.

export type Profile = { pts: Vector2[]; r: (y: number) => number; dr: (y: number) => number; top: number }

function profileOf(fn: (t: number) => [number, number], n = 120): Profile {
  const pts: Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const [r, y] = fn((i / n) * Math.PI)
    pts.push(new Vector2(Math.max(r, 0), y))
  }
  const at = (y: number) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y >= y) {
        const a = pts[i - 1], b = pts[i]
        const k = (y - a.y) / Math.max(b.y - a.y, 1e-6)
        return [a.x + (b.x - a.x) * k, (b.x - a.x) / Math.max(b.y - a.y, 1e-6)] as const
      }
    }
    return [0, 0] as const
  }
  return { pts, r: (y) => at(y)[0], dr: (y) => at(y)[1], top: pts[pts.length - 1].y }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

// Drop: a round belly and a soft, blunt top (no point).
export const dropProfile = profileOf((t) => {
  const f = 1 + 0.42 * smooth(Math.PI / 2 - 0.35, Math.PI / 2 + 0.55, t)
  const y = -Math.cos(t) * f
  const k = 0.94 - 0.44 * smooth(-0.2, 1.2, y)
  return [Math.sin(t) * k, y]
})
export const ballProfile = profileOf((t) => [Math.sin(t), -Math.cos(t)])

// A point on the body surface at height y and angle phi from the front, pushed out by off, and the
// rotation that makes a plane there face outward.
const o3 = new Object3D()
export function onSurface(p: Profile, y: number, phi: number, off = 0.012): { position: Vector3; quaternion: Quaternion } {
  const r = p.r(y) + off
  const pos = new Vector3(r * Math.sin(phi), y, r * Math.cos(phi))
  const n = new Vector3(Math.sin(phi), -p.dr(y), Math.cos(phi)).normalize()
  o3.position.copy(pos)
  o3.up.set(0, 1, 0)
  o3.lookAt(pos.clone().add(n))
  return { position: pos, quaternion: o3.quaternion.clone() }
}

export type VariantSpec = {
  scale: number
  eye: { x: number; y: number; s: number; aspect: number; lid: number; spark: number }
  mouthY: number
  cheek: { x: number; y: number; k: number }
  profile: Profile
}

export const specs: Record<Variant, VariantSpec> = {
  a: { scale: 0.84, eye: { x: 0.34, y: 0.1, s: 0.285, aspect: 1, lid: 0, spark: 1 }, mouthY: -0.26, cheek: { x: 0.62, y: -0.16, k: 0.6 }, profile: dropProfile },
  b: { scale: 1, eye: { x: 0.3, y: 0.08, s: 0.28, aspect: 0.74, lid: 0, spark: 1 }, mouthY: -0.26, cheek: { x: 0.56, y: -0.14, k: 0.4 }, profile: ballProfile },
  c: { scale: 0.98, eye: { x: 0.34, y: 0.06, s: 0.25, aspect: 1.2, lid: 0.42, spark: 0 }, mouthY: -0.24, cheek: { x: 0.6, y: -0.16, k: 1 }, profile: ballProfile },
}

export function makeKit(variant: Variant) {
  const spec = specs[variant]
  const geo: BufferGeometry[] = []
  const g = <T extends BufferGeometry>(x: T) => (geo.push(x), x)

  const body = softMaterial({ rim: variant === 'c' ? 0.55 : 0.28, rimPow: variant === 'c' ? 2.1 : 2.8, spec: variant === 'c' ? 0 : 0.3, disp: variant === 'c' ? 1 : 0 })
  body.userData.rimCream = variant === 'c'
  const strong = softMaterial({ rim: 0.2, spec: 0.25 })
  const ink = softMaterial({ rim: 0.05, spec: 0.35 })
  const cream = softMaterial({ rim: 0, spec: 0.2 })
  const mark = softMaterial({ rim: 0, spec: 0, opacity: 0.999 })
  const eye = eyeMaterial()
  eye.uniforms.uAspect.value = spec.eye.aspect
  eye.uniforms.uSpark.value = spec.eye.spark
  const blush = blobMaterial()
  const shadow = blobMaterial()
  const halo = blobMaterial(true)
  const mats = { body: [body], strong: [strong], ink: [ink], cream: [cream], mark: [mark] }
  const all: ShaderMaterial[] = [body, strong, ink, cream, mark, eye, blush, shadow, halo]

  const geos = {
    body: variant === 'a' ? g(new LatheGeometry(spec.profile.pts, 72)) : g(variant === 'c' ? new IcosahedronGeometry(1, 22) : new SphereGeometry(1, 64, 48)),
    inner: g(new SphereGeometry(0.72, 40, 30)),
    halo: g(new IcosahedronGeometry(1.07, 22)),
    plane: g(new PlaneGeometry(2, 2)),
    disc: g(new CircleGeometry(1, 32)),
    ear: g(new CapsuleGeometry(0.15, 0.2, 8, 16)),
    mouth: g(new CapsuleGeometry(0.06, 0.1, 8, 14).rotateZ(Math.PI / 2)),
    smile: g(new TorusGeometry(0.15, 0.022, 10, 28, Math.PI).rotateZ(Math.PI)),
    arm: g(new CapsuleGeometry(0.115, 0.4, 8, 14).rotateZ(-Math.PI / 2).translate(0.2, 0, 0)),
    hand: g(new SphereGeometry(0.13, 20, 16)),
    stalk: g(new CapsuleGeometry(0.022, 0.28, 6, 10)),
    dot: g(new SphereGeometry(0.095, 24, 18)),
    zbar: g(new CapsuleGeometry(0.032, 0.2, 6, 10).rotateZ(Math.PI / 2)),
    zdiag: g(new CapsuleGeometry(0.032, 0.26, 6, 10).rotateZ(Math.PI / 2.9)),
    tuft: g(new SphereGeometry(1, 20, 16)),
  }
  const zMats = [0, 1, 2].map(() => softMaterial({ rim: 0, spec: 0, opacity: 0 }))
  zMats.forEach((m) => (m.transparent = true))
  all.push(...zMats)

  return {
    spec, geos, mats, eye, blush, shadow, halo, zMats, all,
    dispose() {
      geo.forEach((x) => x.dispose())
      all.forEach((m) => m.dispose())
    },
  }
}
export type Kit = ReturnType<typeof makeKit>
