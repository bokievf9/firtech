import { BackSide, CircleGeometry, Color, CylinderGeometry, DoubleSide, RingGeometry, Float32BufferAttribute, BufferGeometry, ShaderMaterial, SphereGeometry, Vector2, Vector3 } from 'three'
import type { T3 } from '@/lib/fira/pose3'
import type { Palette } from '@/lib/fira/palette'
import { rig7 } from '@/lib/fira/turtle7'
import { limb, makeKit6, paint6 } from './fira-kit6'
import { blobMaterial, clayMaterial, uni } from './materials'

// Round seven kit: the round-six clay kit recoloured to the owner's reference art (lime body, cream plastron,
// teal shell, dark green outlines), plus two small shaders: the toon outline (an inverted hull pushed out in
// view space, one thin line on every shape) and the plastron (cream plate with 2 x 3 soft segment lines).
const outline = {
  vert: /* glsl */ `
    uniform float uW;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      mv.xyz += normalize(normalMatrix * normal) * uW;
      gl_Position = projectionMatrix * mv;
    }`,
  frag: /* glsl */ `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
      #include <colorspace_fragment>
    }`,
}
const plate = {
  vert: /* glsl */ `
    varying vec3 vN; varying vec3 vP;
    void main() { vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uLine; uniform vec3 uKey;
    varying vec3 vN; varying vec3 vP;
    float ln(float d) { return 1.0 - smoothstep(0.012, 0.012 + fwidth(d) * 1.4 + 1e-4, d); }
    void main() {
      vec3 n = normalize(vN);
      float lit = smoothstep(-0.2, 0.95, dot(n, normalize(uKey)) * 0.7 + 0.3);
      vec3 col = mix(uShade, uColor, lit);
      float x = vP.x, y = vP.y;
      float seg = ln(abs(x)) * step(abs(y), 0.97);
      seg = max(seg, ln(abs(y - 0.3 + 0.05 * x * x)) * step(abs(x), 0.95));
      seg = max(seg, ln(abs(y + 0.36 + 0.05 * x * x)) * step(abs(x), 0.95));
      float edge = smoothstep(0.9, 0.97, length(vP.xy));
      col = mix(col, uLine, max(seg * 0.9, edge * 0.8));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}

// Face parts as meshes (round eight): flat shapes whose vertices are projected onto the head sphere in the vertex shader,
// so eye white, iris, highlights, lids, brows, nose dots and the head gloss all hug the dome. Face space = the unit head sphere
// (radius 0.5), x right, y up; uC centre, uS size, uRot tilt, uOff how far above the skin (a layer).
const decal = {
  vert: /* glsl */ `
    uniform vec2 uC; uniform vec2 uS; uniform float uRot; uniform float uOff;
    void main() {
      vec2 q = position.xy * uS;
      float c = cos(uRot), s = sin(uRot);
      vec2 p = vec2(q.x * c - q.y * s, q.x * s + q.y * c) + uC;
      float z = sqrt(max(0.25 - dot(p, p), 0.0)) + uOff;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, z, 1.0);
    }`,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform float uAlpha;
    void main() {
      gl_FragColor = vec4(uColor, uAlpha);
      #include <colorspace_fragment>
    }`,
}
export const decalMat = (col: string, off: number, alpha = 1) =>
  new ShaderMaterial({
    vertexShader: decal.vert, fragmentShader: decal.frag, side: DoubleSide, transparent: alpha < 1, depthWrite: false,
    uniforms: { uC: { value: new Vector2() }, uS: { value: new Vector2(1, 1) }, uRot: { value: 0 }, uOff: { value: off }, uColor: { value: new Color(col) }, uAlpha: { value: alpha } },
  })
export const EYE_PARTS = ['ring', 'white', 'iris', 'pupil', 'hl1', 'hl2', 'lidD', 'lidL', 'lowD', 'lowL', 'arc', 'brow'] as const
export type EyePart = (typeof EYE_PARTS)[number]
// The lid: a convex dome (triangle fan, no triangulation surprises) whose lower edge droops a little in the middle.
const lidShape = () => {
  const pts: [number, number][] = []
  const N = 16
  for (let i = 0; i <= N; i++) {
    const t = Math.PI * (i / N)
    pts.push([-1.08 * Math.cos(t), 1.05 * Math.pow(Math.sin(t), 0.8)]) // from the left corner over the top to the right corner... mirrored below
  }
  pts.reverse()
  for (let i = 1; i < N; i++) {
    const x = -1.08 + (2.16 * i) / N
    pts.push([x, -0.2 * (1 - (x / 1.08) ** 2)])
  }
  const pos: number[] = [0, 0.4, 0]
  pts.forEach((p) => pos.push(p[0], p[1], 0))
  const idx: number[] = []
  for (let i = 1; i <= pts.length; i++) idx.push(0, i, i === pts.length ? 1 : i + 1)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}
const LAYER: Record<EyePart, number> = { ring: 0.012, white: 0.012, iris: 0.012, pupil: 0.012, hl1: 0.012, hl2: 0.012, lowD: 0.012, lowL: 0.012, lidD: 0.012, lidL: 0.012, arc: 0.012, brow: 0.012 }
const EYE_COL: Record<EyePart, string> = { ring: '#1f3b18', white: '#efe2b4', iris: '#2f5a24', pupil: '#0e1c0c', hl1: '#ffffff', hl2: '#ffffff', lidD: '#1f3b18', lidL: '#90c93c', lowD: '#1f3b18', lowL: '#90c93c', arc: '#1f3b18', brow: '#2c4a1e' }

export function makeEyes7() {
  const circle = new CircleGeometry(1, 36), lid = lidShape(), arc = new RingGeometry(0.86, 1, 28, 1, 0, Math.PI), nose = new CircleGeometry(1, 16)
  const geoOf: Record<EyePart, BufferGeometry> = { ring: circle, white: circle, iris: circle, pupil: circle, hl1: circle, hl2: circle, lidD: lid, lidL: lid, lowD: lid, lowL: lid, arc, brow: circle }
  const sides = [-1, 1].map(() => Object.fromEntries(EYE_PARTS.map((n) => [n, decalMat(EYE_COL[n], LAYER[n])])) as Record<EyePart, ShaderMaterial>)
  const extra = {
    noseL: decalMat('#2c4a1e', 0.012), noseR: decalMat('#2c4a1e', 0.012),
    gloss: decalMat('#ffffff', 0.012, 0.5), dotA: decalMat('#ffffff', 0.012, 0.55), dotB: decalMat('#ffffff', 0.012, 0.5),
  }
  const mats = [...sides.flatMap((s) => Object.values(s)), ...Object.values(extra)]
  return {
    sides, extra, geoOf, nose, circle, geos: [circle, lid, arc, nose],
    dispose() {
      this.geos.forEach((g) => g.dispose())
      mats.forEach((m) => m.dispose())
    },
  }
}
export type Eyes7 = ReturnType<typeof makeEyes7>

const setD = (m: ShaderMaterial, x: number, y: number, sx: number, sy: number, rot = 0, show = true) => {
  const u = uni(m)
  u.uC!.value.set(x, y)
  u.uS!.value.set(show ? sx : 0, show ? sy : 0)
  u.uRot!.value = rot
}
export type FaceSpec7 = { sep: number; y: number; w: number; h: number; gap: number; look: [number, number]; nose: number }
export const face7: FaceSpec7 = { sep: 0.235, y: -0.05, w: 0.122, h: 0.132, gap: 0.05, look: [0.07, 0.05], nose: -0.15 }
export const faceG7: FaceSpec7 = { ...face7, gap: 0.11 }
export const closedEye7 = (P: T3) => P.bend > 0.5
export type EyeState7 = { closed: boolean; lids: boolean; surprised: boolean }
// One frame of the face parts. P: spring values, blink 0..1, sleep: closed with a downward arc.
export function driveEyes7(e: Eyes7, f: FaceSpec7, P: T3, blink: number, sleep: boolean, lookX: number, lookY: number): EyeState7 {
  const open = 1 - blink * 0.94
  const closed = closedEye7(P) || sleep
  const w = f.w * P.eyeW, h0 = f.h * P.eyeH
  const lx = lookX * f.look[0] * 0.5, ly = lookY * f.look[1] * 0.5
  const cy0 = f.y + P.eyeY * f.h * 0.5
  const surprised = P.lidTop < 0.02 && P.eyeH > 1.15 && !closed
  ;([-1, 1] as const).forEach((s, i) => {
    const m = e.sides[i]!
    const cx = s * f.sep + lx
    const asym = P.asym
    const h = h0 * open * (s > 0 ? 1 - 0.32 * asym : 1 + 0.08 * asym)
    const cy = cy0 + ly
    const lt = Math.min(0.85, Math.max(P.lidTop, 0) + (s > 0 ? 0.2 * asym : 0))
    const lb = Math.max(P.lidBot, 0)
    const ink = !closed
    setD(m.ring, cx, cy, w * 1.1, h * 1.1, 0, ink)
    setD(m.white, cx, cy, w, h, 0, ink)
    const ix = Math.max(-1, Math.min(1, lookX)) * w * 0.14, iy = Math.max(-1, Math.min(1, lookY)) * h * 0.12
    setD(m.iris, cx + ix, cy + iy - h * 0.02, w * 0.95, h * 0.93, 0, ink)
    setD(m.pupil, cx + ix, cy + iy - h * 0.02, w * 0.55, h * 0.55, 0, ink)
    setD(m.hl2, cx + ix + w * 0.36, cy + iy - h * 0.18, w * 0.11, w * 0.11, 0, ink)
    const rot = Math.atan(-P.slant * s * 0.8)
    const ly0 = cy + h * (1 - 2 * lt)
    const showTop = ink && lt > 0.14
    const hy = Math.min(cy + iy + h * 0.28, showTop ? ly0 - w * 0.3 : 9)
    setD(m.hl1, cx + ix - w * 0.28, hy, w * 0.25, w * 0.25, 0, ink)
    const lh = Math.max(0.05, 1.02 * h - (ly0 - cy)) / 1.05 // the dome ends at the top of the eye, so the lid keeps the eye's outline
    setD(m.lidD, cx, ly0 - 0.003, w * 1.08, lh * 1.07 + 0.004, rot, showTop)
    setD(m.lidL, cx, ly0, w * 1.03, lh, rot, showTop)
    const lyb = cy - h * (1 - 2 * lb)
    const showLow = ink && lb > 0.04
    setD(m.lowD, cx, lyb + 0.005, w * 1.04, -h * 0.9, 0, showLow)
    setD(m.lowL, cx, lyb, w * 1.04, -h * 0.9, 0, showLow)
    // closed: a happy arc (up) or a sleepy one (down)
    setD(m.arc, cx, cy - (sleep ? -0.012 : 0.03), w * 1.0, (sleep ? -1 : 1) * w * 0.8, 0, closed)
    // brow: a short thin stroke above the eye, one raised on «Скепсис» and «Всезнайка»
    const raise = P.browY * 0.03 + (s > 0 ? asym * 0.045 : -asym * 0.012)
    const bx = cx, by = f.y + f.h * P.eyeH * 0.9 + f.gap + raise + (closed ? 0.0 : 0)
    setD(m.brow, bx, by + (cy - f.y) * 0.5, 0.05, 0.0085, -s * P.browTilt * 0.5, true)
  })
  const nx = lookX * f.look[0] * 0.25
  setD(e.extra.noseL, -0.034 + nx, f.nose, 0.0095, 0.0095)
  setD(e.extra.noseR, 0.034 + nx, f.nose, 0.0095, 0.0095)
  return { closed, lids: P.lidTop > 0.02, surprised }
}
// Head gloss of the reference: a soft streak at the top left and two small dots at the top right (static).
export function placeGloss7(e: Eyes7) {
  setD(e.extra.gloss, -0.17, 0.4, 0.085, 0.017, 0.5)
  setD(e.extra.dotA, 0.2, 0.36, 0.019, 0.019)
  setD(e.extra.dotB, 0.255, 0.3, 0.011, 0.011)
}

export function makeKit7() {
  const k = makeKit6()
  const ol = new ShaderMaterial({ vertexShader: outline.vert, fragmentShader: outline.frag, side: BackSide, uniforms: { uColor: { value: new Color('#1f5a12') }, uW: { value: 0.017 } } })
  const plastron = new ShaderMaterial({
    vertexShader: plate.vert, fragmentShader: plate.frag,
    uniforms: { uColor: { value: new Color('#fbeab0') }, uShade: { value: new Color('#e8cf84') }, uLine: { value: new Color('#e3bd62') }, uKey: { value: new Vector3(-0.5, 0.7, 0.55) } },
  })
  const eyes = makeEyes7()
  placeGloss7(eyes)
  const geo = { arm: limb(rig7.arm.len, 0.15, 0.135, 0.145, 0.5), sphere: new SphereGeometry(1, 40, 28), hex: new CylinderGeometry(1, 1, 0.04, 6).rotateX(Math.PI / 2) }
  return {
    ...k, ol, plastron, eyes, glow: blobMaterial(), scute: clayMaterial({ rim: 0.1, spec: 0.1, specPow: 16, sss: 0 }), geos: { ...k.geos, ...geo },
    dispose() {
      k.dispose()
      geo.arm.dispose()
      geo.sphere.dispose()
      geo.hex.dispose()
      ol.dispose()
      plastron.dispose()
      eyes.dispose()
      this.glow.dispose()
      this.scute.dispose()
    },
  }
}
export type Kit7 = ReturnType<typeof makeKit7>

export function paint7(kit: Kit7, p: Palette) {
  paint6(kit, p)
  const set = (m: ShaderMaterial, col: string, sh: string, rim: string, sss = col) => {
    const u = uni(m)
    u.uColor!.value.set(col)
    u.uShade!.value.set(sh)
    u.uRim!.value.set(rim)
    u.uSss?.value.set(sss)
  }
  // Target renders (ref-3d-target-*.jpg): soft matte clay, olive-lime body, yellow plastron, dark green shell, no hard outline.
  set(kit.mats.lime, '#97d03c', '#6fae2a', '#c6ea6a', '#b4e052')
  set(kit.mats.cream, '#f3e4a6', '#dcc680', '#fff6c8')
  set(kit.mats.graphite, '#1b1f1a', '#0b0e0b', '#3c4a38')
  uni(kit.mats.glass).uOpacity!.value = 0.07 // clear lenses: the eyes read through them
  set(kit.pad, '#243224', '#101810', '#3a5a36')
  const s = uni(kit.shell)
  s.uColor!.value.set('#1d7a3b')
  s.uShade!.value.set('#115a2a')
  s.uLit!.value.set('#3aa352')
  s.uSeam!.value = 0.85
  uni(kit.face).uBg!.value.set('#ffffff')
  uni(kit.face).uInk!.value.set('#2c4a1e')
  uni(kit.face).uHide!.value = 1 // eyes, brows and nose are meshes (makeEyes7); the shader draws the mouth only
  uni(kit.blush).uColor!.value.set('#f0a35e')
  uni(kit.blush).uAlpha!.value = p.dark ? 0.6 : 0.7
  uni(kit.plastron).uColor!.value.set('#f4df7e')
  uni(kit.plastron).uShade!.value.set('#e2c966')
  uni(kit.plastron).uLine!.value.set('#d3b856')
  uni(kit.ol).uColor!.value.set(p.dark ? '#7fd24a' : '#2c6a1c')
  uni(kit.ol).uW!.value = p.dark ? 0.012 : 0.008 // clay look: only a hairline, a brighter one in the dark so the figure reads
  set(kit.scute, '#27894a', '#1b6a38', '#46b872')
  uni(kit.glow).uColor!.value.set('#a6ef42')
  uni(kit.glow).uAlpha!.value = p.dark ? 0.2 : 0
  uni(kit.glow).uSoft!.value = 0
  uni(kit.shadow).uColor!.value.set(p.dark ? '#000000' : '#0d1408')
  uni(kit.shadow).uAlpha!.value = p.dark ? 0.4 : 0.2
  uni(kit.shadow2).uColor!.value.set(p.dark ? '#000000' : '#0d1408')
  uni(kit.shadow2).uAlpha!.value = p.dark ? 0.2 : 0.08
}
