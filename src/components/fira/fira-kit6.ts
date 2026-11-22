import { Color, LatheGeometry, SphereGeometry, Vector2, type BufferGeometry } from 'three'
import type { Palette } from '@/lib/fira/palette'
import { rig6 } from '@/lib/fira/turtle6'
import { makeKit5, paint5 } from './fira-kit5'
import { blobMaterial, clayMaterial, uni } from './materials'

// Round six kit: the round-five clay materials and shell shader, plus the soft limbs (one lathe volume per
// arm and per leg: no segments, no joints), blush cheeks, a laptop screen and the face with eye highlights.
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// A limb as a profile of radius along its length (y from 0 down to -len): wide where it grows out of the
// body, tapering smoothly, a soft swell at the hand or foot, a round cap. r0 root, r1 narrowest, r2 end.
function limb(len: number, r0: number, r1: number, r2: number, taper: number) {
  const pts: Vector2[] = Array.from({ length: 8 }, (_, i) => {
    const a = (1 - i / 8) * (Math.PI / 2)
    return new Vector2(r0 * Math.cos(a), r0 * 1.1 * Math.sin(a))
  })
  const n = 26
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const r = r0 + (r1 - r0) * sm(0, taper, t) + (r2 - r1) * sm(taper, 1, t) * 0.9
    pts.push(new Vector2(r, -len * t * 0.9))
  }
  const end = pts[pts.length - 1]!
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push(new Vector2(end.x * Math.cos(a), end.y - end.x * 0.9 * Math.sin(a)))
  }
  return new LatheGeometry(pts.reverse(), 28)
}

// The body: a soft pear (fuller below), one lathe volume, unit height 2, scaled by the rig.
const pear = () => new LatheGeometry(Array.from({ length: 41 }, (_, i) => {
  const t = (i / 40) * Math.PI, u = (1 - Math.cos(t)) / 2
  return new Vector2(Math.pow(Math.sin(t), 0.85) * (1.1 - 0.16 * u), -Math.cos(t))
}), 40)

export function makeKit6() {
  const k5 = makeKit5('r')
  const geo: BufferGeometry[] = []
  const g = <T extends BufferGeometry>(x: T) => (geo.push(x), x)
  const blush = blobMaterial()
  const screen = clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.55 })
  const pad = clayMaterial({ rim: 0.2, spec: 0.05, specPow: 18, sss: 0 })
  k5.face.uniforms.uHl!.value = 1
  const geos = {
    arm: g(limb(rig6.arm.len, 0.17, 0.105, 0.13, 0.55)),
    leg: g(limb(rig6.leg.len, 0.26, 0.17, 0.17, 0.8)),
    sphere: g(new SphereGeometry(1, 40, 28)),
    body: g(pear()),
  }
  const all = [blush, screen, pad]
  return {
    ...k5,
    geos: { ...k5.geos, ...geos },
    blush, screen, pad,
    dispose() {
      k5.dispose()
      geo.forEach((x) => x.dispose())
      all.forEach((m) => m.dispose())
    },
  }
}
export type Kit6 = ReturnType<typeof makeKit6>

export function paint6(kit: Kit6, p: Palette) {
  paint5(kit, p)
  const cream = new Color(p.cream), ink = new Color(p.ink)
  const set = (m: typeof kit.pad, col: Color, sh: Color, rim: Color) => {
    const u = uni(m)
    u.uColor!.value.copy(col)
    u.uShade!.value.copy(sh)
    u.uRim!.value.copy(rim)
    u.uSss?.value.copy(col)
  }
  set(kit.pad, ink.clone().lerp(cream, 0.22), ink.clone().lerp(cream, 0.05), cream)
  uni(kit.screen).uColor!.value.set(p.accent)
  uni(kit.face).uBg!.value.set(p.cream)
  uni(kit.blush).uColor!.value.set(p.blush)
  uni(kit.blush).uAlpha!.value = p.dark ? 0.8 : 0.95
}
