import {
  CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, LatheGeometry, PlaneGeometry, ShaderMaterial,
  SphereGeometry, Vector2, Vector4, type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Palette } from '@/lib/fira/palette'
import { eyeSpec, tintLight, type T3 } from '@/lib/fira/pose3'
import type { RoundThree } from '@/lib/fira/pose'
import { profileOf, type Profile } from './fira-kit'
import { blobMaterial, clayMaterial, uni } from './materials'

// Round three (I to M): matte ceramic bodies and one face shader («glyph») for all five faces. The
// glyph draws on the surface itself (a visor band, a lens, a screen, a face cap), so a turned figure
// keeps its face on the curve. Two modes: lime light-shapes on dark graphite (I, J, K) or graphite
// marks on lime (L, M). Eyes are one SDF with lid cuts (top cut with a slant, bottom cut that bends
// into ∩ arcs), a ring option and asymmetry; a mouth line with curve and a small o; brows.

const glyph = {
  vert: /* glsl */ `
    uniform float uMap; uniform float uR;
    varying vec2 vF; varying vec3 vN; varying vec3 vV;
    void main() {
      vF = uMap > 0.5 ? vec2(atan(position.x, position.z) * uR, position.y) : position.xy;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  frag: /* glsl */ `
    uniform float uMode; uniform vec3 uBg; uniform vec3 uLight; uniform vec3 uInk; uniform float uGlow;
    uniform vec4 uMask; uniform float uMaskR; uniform vec2 uHalo; uniform float uRound; uniform float uCount; uniform float uLine;
    uniform vec4 uEye; uniform vec4 uLid; uniform vec4 uEye2; uniform vec4 uMouth; uniform vec3 uMouthO; uniform vec4 uBrow;
    varying vec2 vF; varying vec3 vN; varying vec3 vV;
    float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
    float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
    float eye(vec2 p, float s) {
      float w = uEye.z, h = uEye.w, lt = uLid.x;
      if (s > 0.0) { h *= 1.0 - 0.32 * uEye2.z; lt += 0.2 * uEye2.z; } else { h *= 1.0 + 0.08 * uEye2.z; }
      h = max(h, uMode > 0.5 ? uLine * 0.8 : 0.006);
      float r = min(w, h);
      float d = mix(sdEll(p, vec2(w, h)), sdBox(p, vec2(w, h), r * 0.92), uRound);
      d = max(d, p.y - (h * (1.0 - 2.0 * lt) - uLid.w * p.x * s * 0.8));
      float xn = clamp(p.x / w, -1.0, 1.0);
      d = max(d, (-h + 2.0 * h * uLid.y + uLid.z * 0.55 * h * (1.0 - xn * xn)) - p.y);
      float th = 0.28 * r + 0.004;
      return mix(d, abs(d + th) - th, uEye2.w);
    }
    void main() {
      vec2 f = vF - uMask.xy;
      float mask = sdBox(f, uMask.zw, uMaskR);
      vec2 e = vec2(f.x - uEye2.x, vF.y - uEye.y - uEye2.y);
      float d = uCount > 1.5 ? min(eye(e + vec2(uEye.x, 0.0), -1.0), eye(e - vec2(uEye.x, 0.0), 1.0)) : eye(e, 0.0);
      vec2 m = vec2(f.x - uEye2.x * 0.5, vF.y - uMouth.x - uEye2.y * 0.5);
      float mw = uMouth.y, xn = m.x / max(mw, 0.001);
      float yc = uMouth.z * 0.5 * mw * (xn * xn - 0.4);
      float sl = uMouth.z * 1.0 * xn;
      float dm = max(abs(m.y - yc) / sqrt(1.0 + sl * sl), abs(m.x) - mw) - uLine;
      dm = mix(dm, sdEll(m, uMouthO.xy), uMouthO.z);
      if (uMouth.w < 0.5) dm = 1e3;
      float db = 1e3;
      if (uBrow.w > 0.5) {
        for (int i = 0; i < 2; i++) {
          float s = i == 0 ? -1.0 : 1.0;
          vec2 b = e - vec2(s * uEye.x, uEye.w + uBrow.x);
          float a = -s * uBrow.z * 0.5;
          vec2 dir = vec2(cos(a), sin(a)) * uBrow.y;
          db = min(db, sdSeg(b, -dir, dir) - uLine);
        }
      }
      float w = fwidth(d) * 1.2 + 1e-4;
      float inside = 1.0 - smoothstep(-fwidth(mask), fwidth(mask), mask);
      vec3 col; float a;
      if (uMode < 0.5) {
        vec3 n = normalize(vN), v = normalize(vV);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 2.0);
        float band = smoothstep(0.16, 0.0, abs(n.y * 0.9 - n.x * 0.35 - 0.42));
        col = uBg + vec3(0.05) * fr + vec3(0.06) * band;
        float core = 1.0 - smoothstep(-w, w, d);
        float lit = 0.3 + 0.7 * uGlow;
        float halo = exp(-max(d, 0.0) * uHalo.x) * uHalo.y * uGlow;
        col += uLight * halo * (1.0 - core);
        col = mix(col, uLight * (0.6 + 0.65 * lit), core);
        col = mix(col, vec3(1.0), core * smoothstep(0.0, -0.06, d) * 0.22 * uGlow);
        // One-eyed lens (J): a thin light ring at the rim carries the mood at a distance.
        if (uCount < 1.5) col = mix(col, uLight, (1.0 - smoothstep(0.0, 0.014, abs(mask + 0.02) - 0.008)) * (0.15 + 0.85 * uGlow * uGlow));
        a = inside;
      } else {
        float dd = min(d, min(dm, db));
        float ww = fwidth(dd) * 1.2 + 1e-4;
        col = uInk;
        a = (1.0 - smoothstep(-ww, ww, dd)) * inside;
      }
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }`,
}

export function glyphMaterial(o: { mode: 0 | 1; cyl?: number; mask: [number, number, number, number]; maskR: number; round?: number; count?: 1 | 2; line?: number; halo?: [number, number] }) {
  return new ShaderMaterial({
    vertexShader: glyph.vert,
    fragmentShader: glyph.frag,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
    uniforms: {
      uMap: { value: o.cyl ? 1 : 0 }, uR: { value: o.cyl ?? 1 },
      uMode: { value: o.mode }, uBg: { value: new Color('#1d221b') }, uLight: { value: new Color('#c6ff3d') }, uInk: { value: new Color('#0d1408') },
      uGlow: { value: 0.5 }, uHalo: { value: new Vector2(...(o.halo ?? [22, 0.5])) }, uMask: { value: new Vector4(...o.mask) }, uMaskR: { value: o.maskR }, uRound: { value: o.round ?? 0 },
      uCount: { value: o.count ?? 2 }, uLine: { value: o.line ?? 0.012 },
      uEye: { value: new Vector4() }, uLid: { value: new Vector4() }, uEye2: { value: new Vector4() },
      uMouth: { value: new Vector4() }, uMouthO: { value: new Vector4() }, uBrow: { value: new Vector4() },
    },
  })
}

// Face layout per variant (units of the figure): eye spacing (half), eye centre y, base half width and
// height, mouth y and half width, brow gap and half length, how far the gaze moves the face.
export type FaceSpec3 = { sep: number; y: number; w: number; h: number; mouthY?: number; mouthW?: number; brow?: [number, number]; look: [number, number] }
export const faces3: Record<RoundThree, FaceSpec3> = {
  i: { sep: 0.2, y: 1.5, w: 0.14, h: eyeSpec.i.eyeHalf, look: [0.12, 0.05] },
  j: { sep: 0, y: 0, w: eyeSpec.j.eyeHalf, h: eyeSpec.j.eyeHalf, look: [0.1, 0.08] },
  k: { sep: 0.3, y: 0.04, w: 0.11, h: eyeSpec.k.eyeHalf, look: [0.14, 0.08] },
  l: { sep: 0.15, y: 0.06, w: eyeSpec.l.eyeHalf, h: eyeSpec.l.eyeHalf, mouthY: -0.13, mouthW: 0.085, look: [0.08, 0.06] },
  m: { sep: 0.3, y: 0.1, w: 0.12, h: eyeSpec.m.eyeHalf, mouthY: -0.3, mouthW: 0.17, brow: [0.22, 0.075], look: [0.12, 0.08] },
}

// Writes one frame of face state into a glyph. P: the spring values, blink 0..1, mo: lip-sync 0..1.
export function driveGlyph(mat: ShaderMaterial, f: FaceSpec3, P: T3, blink: number, mo: number, pal: { light: string; accent: string }, opts: { pulse?: number } = {}) {
  const u = uni(mat)
  const open = 1 - blink * 0.94
  const pulse = 1 + (opts.pulse ?? 0) * mo
  const h = f.h * P.eyeH * open * pulse
  u.uEye!.value.set(f.sep, f.y + P.eyeY * f.h, f.w * P.eyeW * pulse, h)
  u.uLid!.value.set(Math.max(P.lidTop, 0), Math.max(P.lidBot, 0), Math.max(P.bend, 0), P.slant)
  u.uEye2!.value.set(P.lookX * f.look[0], P.lookY * f.look[1], P.asym, Math.min(Math.max(P.ring, 0), 1))
  if (f.mouthY !== undefined && f.mouthW !== undefined) {
    const talk = Math.min(mo * 1.4, 1)
    const o = Math.max(Math.min(P.mouthO, 1), talk)
    const rx = f.mouthW * (P.mouthO > talk ? 0.32 : 0.6), ry = f.mouthW * (P.mouthO > talk ? 0.38 : 0.12 + 0.3 * talk)
    u.uMouth!.value.set(f.mouthY, f.mouthW * P.mouthW, P.smile, 1)
    u.uMouthO!.value.set(rx, ry, o > 0.05 ? Math.min(o * 1.6, 1) : 0)
  }
  if (f.brow) u.uBrow!.value.set(f.brow[0] + P.browY * 0.05, f.brow[1], P.browTilt, 1)
  u.uGlow!.value = Math.min(Math.max(P.glow + mo * 0.25, 0), 1)
  u.uLight!.value.set(tintLight(pal.accent, P.warm))
}

// Body profiles. I: a pebble 1 : 1.6, slightly fuller below. L: a slim soft body, wide foot, narrow
// shoulders. J: a low dome base and a tapered stem.
const PEBBLE_H = 2.2
export const pebbleProfile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  return [0.69 * Math.pow(Math.sin(t), 0.86) * (1.05 - 0.12 * u), u * PEBBLE_H]
}, 96)
export const L_BODY = 1.62
export const slimProfile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  return [Math.pow(Math.sin(t), 0.5) * (0.19 + 0.24 * Math.pow(1 - u, 1.7)), u * L_BODY]
}, 80)
export const domeProfile = [new Vector2(0, 0), ...Array.from({ length: 33 }, (_, i) => {
  const th = (i / 32) * (Math.PI / 2)
  return new Vector2(0.62 * Math.pow(Math.cos(th), 0.55), 0.42 * Math.sin(th))
})]
export const stemProfile: Profile = profileOf((t) => {
  const u = (1 - Math.cos(t)) / 2
  return [Math.pow(Math.sin(t), 0.25) * (0.3 - 0.1 * u), u * 0.7]
}, 40)

export const specs3: Record<RoundThree, { scale: number; shadow: number; hover: number; zz: [number, number] }> = {
  i: { scale: 1.3, shadow: 0.62, hover: 0.2, zz: [0.6, 2.1] },
  j: { scale: 1.36, shadow: 0.8, hover: 0, zz: [0.7, 2.0] },
  k: { scale: 1.3, shadow: 0.95, hover: 0, zz: [0.85, 1.9] },
  l: { scale: 1.24, shadow: 0.55, hover: 0, zz: [0.6, 2.4] },
  m: { scale: 1.36, shadow: 0.62, hover: 0.2, zz: [0.85, 2.1] },
}

export function makeKit3(variant: RoundThree) {
  const geo: BufferGeometry[] = []
  const g = <T extends BufferGeometry>(x: T) => (geo.push(x), x)
  // Matte ceramic: weak broad sheen (spec power 18, about roughness 0.6), almost no terminator band.
  const lime = clayMaterial({ rim: 0.16, spec: 0.12, specPow: 18, sss: 0.12 })
  const cream = clayMaterial({ rim: 0.12, spec: 0.1, specPow: 16, sss: 0.05 })
  const graphite = clayMaterial({ rim: 0.18, spec: 0.22, specPow: 30, sss: 0 })
  const light = clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.4 })
  const shadow = blobMaterial(), shadow2 = blobMaterial(), halo = blobMaterial()
  const zMats = [0, 1, 2].map(() => {
    const m = clayMaterial({ rim: 0, spec: 0, opacity: 0.999, sss: 0 })
    m.transparent = true
    return m
  })

  let face: ShaderMaterial
  const geos: Record<string, BufferGeometry> = {
    disc: g(new CircleGeometry(1, 40)),
    zbar: g(new CapsuleGeometry(0.026, 0.17, 4, 8).rotateZ(Math.PI / 2)),
    zdiag: g(new CapsuleGeometry(0.026, 0.23, 4, 8).rotateZ(-0.65)),
  }
  if (variant === 'i') {
    geos.body = g(new LatheGeometry(pebbleProfile.pts, 72))
    const band = pebbleProfile.pts.filter((p) => p.y > 1.12 && p.y < 1.88).map((p) => new Vector2(p.x * 1.006 + 0.002, p.y))
    geos.visor = g(new LatheGeometry(band, 56, -1.3, 2.6))
    face = glyphMaterial({ mode: 0, cyl: pebbleProfile.r(1.5), mask: [0, 1.5, 0.66, 0.26], maskR: 0.22 })
  } else if (variant === 'j') {
    geos.base = g(new LatheGeometry(domeProfile, 64))
    geos.stem = g(new LatheGeometry(stemProfile.pts, 48))
    geos.head = g(new SphereGeometry(0.52, 64, 48))
    geos.lens = g(new SphereGeometry(0.526, 48, 24, 0, Math.PI * 2, 0, 0.62).rotateX(Math.PI / 2))
    face = glyphMaterial({ mode: 0, mask: [0, 0, 0.29, 0.29], maskR: 0.29, round: 1, count: 1, halo: [13, 0.7] })
  } else if (variant === 'k') {
    geos.body = g(new RoundedBoxGeometry(1.84, 1.7, 0.62, 6, 0.3))
    geos.screen = g(new PlaneGeometry(1.26, 1.1))
    geos.stem = g(new CylinderGeometry(0.022, 0.026, 0.26, 10).translate(0, 0.13, 0))
    geos.ball = g(new SphereGeometry(0.075, 24, 16))
    face = glyphMaterial({ mode: 0, mask: [0, 0, 0.6, 0.52], maskR: 0.2, round: 1 })
  } else if (variant === 'l') {
    geos.body = g(new LatheGeometry(slimProfile.pts, 64))
    geos.head = g(new SphereGeometry(0.46, 64, 48))
    geos.face = g(new SphereGeometry(0.4625, 48, 24, 0, Math.PI * 2, 0, 1.0).rotateX(Math.PI / 2))
    geos.arm = g(new CapsuleGeometry(0.042, 0.42, 6, 12).rotateZ(-Math.PI / 2).translate(0.25, 0, 0))
    geos.collar = g(new CylinderGeometry(0.13, 0.15, 0.05, 32))
    face = glyphMaterial({ mode: 1, mask: [0, 0, 0.5, 0.5], maskR: 0.1, round: 0, line: 0.011 })
  } else {
    geos.body = g(new SphereGeometry(0.95, 72, 48))
    geos.face = g(new SphereGeometry(0.954, 64, 32, 0, Math.PI * 2, 0, 1.25).rotateX(Math.PI / 2))
    face = glyphMaterial({ mode: 1, mask: [0, 0, 1, 1], maskR: 0.1, round: 1, line: 0.015 })
  }
  const all: ShaderMaterial[] = [lime, cream, graphite, light, shadow, shadow2, halo, face, ...zMats]
  return {
    variant, spec: specs3[variant], face: faces3[variant], geos, face3: face,
    mats: { lime, cream, graphite, light }, shadow, shadow2, halo, zMats,
    dispose() {
      geo.forEach((x) => x.dispose())
      all.forEach((m) => m.dispose())
    },
  }
}
export type Kit3 = ReturnType<typeof makeKit3>

// Colours from the palette: lime body, graphite (ink lifted a little toward cream so the visor reads
// as a material, not a hole), cream for the base and the slim body.
export function paint3(kit: Kit3, p: Palette) {
  const accent = new Color(p.accent), ink = new Color(p.ink), cream = new Color(p.cream)
  const set = (m: ShaderMaterial, col: Color, sh: Color, rim: Color) => {
    const u = uni(m)
    u.uColor!.value.copy(col)
    u.uShade!.value.copy(sh)
    u.uRim!.value.copy(rim)
    u.uSss?.value.copy(col)
  }
  set(kit.mats.lime, accent, accent.clone().lerp(ink, p.dark ? 0.3 : 0.4), accent.clone().lerp(cream, 0.5))
  set(kit.mats.cream, cream, cream.clone().lerp(ink, 0.2).lerp(accent, 0.08), cream)
  const gph = ink.clone().lerp(cream, 0.1)
  set(kit.mats.graphite, gph, ink, gph.clone().lerp(cream, 0.25))
  set(kit.mats.light, accent, accent, accent)
  const fu = uni(kit.face3)
  fu.uBg!.value.copy(ink.clone().lerp(cream, 0.07))
  fu.uInk!.value.copy(ink)
  for (const z of kit.zMats) {
    uni(z).uColor!.value.set(p.mark)
    uni(z).uShade!.value.set(p.mark)
  }
  uni(kit.shadow).uColor!.value.set(p.dark ? p.accent : p.ink)
  uni(kit.shadow).uAlpha!.value = p.dark ? 0.24 : 0.22
  uni(kit.shadow2).uColor!.value.set(p.dark ? p.accent : p.ink)
  uni(kit.shadow2).uAlpha!.value = p.dark ? 0.1 : 0.08
  uni(kit.halo).uColor!.value.set(p.accent)
}
