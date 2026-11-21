import { Color, ShaderMaterial, Quaternion, Vector3, BufferAttribute, BufferGeometry, IcosahedronGeometry, SphereGeometry } from 'three'
import type { Palette } from '@/lib/fira/palette'
import type { Turtle } from '@/lib/fira/turtle'
import { glyphMaterial } from './fira-kit3'
import { blobMaterial, clayMaterial, uni } from './materials'

// Round four: the turtle kit. Three shaders on top of the round-two clay: the shell (honeycomb or
// circuit board in lime lines, with an idle / event / talk light layer driven per frame), the HQ screens
// (bars, a graph, text rows, code) and the round-three face glyph for the faces.
const AMBER = '#ffb23d', MINT = '#7ae8c9'

const shell = {
  vert: /* glsl */ `
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
    }`,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uLit; uniform vec3 uEvCol;
    uniform vec3 uKey; uniform vec3 uFill;
    uniform float uHex; uniform float uTime; uniform float uPat; uniform float uEvAge; uniform float uEvAmt; uniform float uTalk; uniform float uIdle;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    const vec2 S = vec2(1.0, 1.7320508);
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec4 hexc(vec2 p) {
      vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / S.xyxy) + 0.5;
      vec4 h = vec4(p - hC.xy * S, p - (hC.zw + 0.5) * S);
      return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
    }
    void main() {
      vec3 n = normalize(vN); vec3 v = normalize(vV);
      float key = clamp((dot(n, normalize(uKey)) + 0.55) / 1.55, 0.0, 1.0);
      float fill = clamp(dot(n, normalize(uFill)) * 0.5 + 0.5, 0.0, 1.0);
      float lit = smoothstep(0.1, 0.96, key * 0.8 + fill * 0.2);
      vec3 o = normalize(vP);
      float th = acos(clamp(o.y, -1.0, 1.0));
      vec2 p = normalize(o.xz + vec2(1e-4)) * th * uHex;
      float d; float h; float len;
      if (uPat < 0.5) {
        vec4 hc = hexc(p);
        vec2 q = abs(hc.xy);
        d = (0.5 - max(dot(q, S * 0.5), q.x)) * 1.0; h = h21(hc.zw); len = length(hc.zw * S) / uHex;
      } else {
        vec2 id = floor(p); vec2 f = fract(p) - 0.5; h = h21(id);
        float dl = h > 0.5 ? abs(f.y) : abs(f.x);
        float pad = abs(length(f - vec2(h > 0.5 ? 0.22 : 0.0, h > 0.5 ? 0.0 : 0.22)) - 0.1);
        d = min(dl, h > 0.72 ? pad : 1.0); len = length(id + 0.5) / uHex;
      }
      float w = fwidth(d) * 1.3 + 1e-4;
      float lw = uPat < 0.5 ? 0.045 : 0.028;
      float ln = 1.0 - smoothstep(lw, lw + w, d);
      vec3 base = mix(uShade, uColor, lit) * (0.92 + 0.14 * h);
      vec3 col = mix(base, uLit * (0.55 + 0.45 * lit), ln * 0.92);
      float tw = smoothstep(0.9, 1.0, sin(uTime * (0.4 + h * 0.6) + h * 40.0) * 0.5 + 0.5) * uIdle;
      float ring = exp(-pow((len - uEvAge * 1.7) / 0.2, 2.0)) * exp(-uEvAge * 0.7) * uEvAmt * step(0.0, uEvAge);
      float wave = exp(-pow((len - fract(uTime * 0.8) * 1.5) / 0.22, 2.0)) * uTalk;
      vec3 glow = uLit * (tw * 0.7 + wave) + uEvCol * ring * 1.5;
      col += glow * (0.22 + 0.78 * ln);
      float fr = pow(1.0 - max(dot(n, v), 0.0), 2.6);
      col = mix(col, uLit, fr * 0.1);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}

const screen = {
  vert: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  frag: /* glsl */ `
    uniform vec3 uBg; uniform vec3 uCol; uniform vec3 uCol2; uniform float uTime; uniform float uKind; uniform float uAct; uniform float uFlash; uniform float uAspect;
    varying vec2 vUv;
    float h11(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
    void main() {
      vec2 p = vUv; vec2 a = vec2(uAspect, 1.0);
      float act = 0.35 + 0.65 * uAct + uFlash;
      float on = 0.0; vec3 c = uCol;
      if (uKind < 0.5) {
        float n = 7.0; float i = floor(p.x * n); float fx = fract(p.x * n);
        float hh = 0.15 + 0.7 * (0.5 + 0.5 * sin(uTime * (0.7 + h11(i)) + h11(i + 3.0) * 6.28)) * min(act, 1.0);
        on = step(fx, 0.72) * step(0.1, p.y) * step(p.y, 0.1 + hh * 0.8);
      } else if (uKind < 1.5) {
        float y = 0.5 + 0.28 * sin(p.x * 9.0 + uTime * 1.3 * act) * sin(p.x * 3.1 - uTime * 0.6) + 0.1 * sin(p.x * 21.0 + uTime * 3.0) * min(act, 1.0);
        on = 1.0 - smoothstep(0.02, 0.05, abs(p.y - y));
        on = max(on, step(abs(p.y - 0.12), 0.012) * 0.4);
      } else {
        float rows = uKind > 2.5 ? 9.0 : 6.0; float r = floor(p.y * rows); float fy = fract(p.y * rows);
        float seed = r + floor(uTime * 0.5 * act + r * 0.37);
        float L = 0.25 + 0.65 * h11(seed + 1.0);
        float ind = uKind > 2.5 ? 0.12 * floor(h11(seed + 9.0) * 3.0) : 0.0;
        on = step(fy, 0.5) * step(0.06 + ind, p.x) * step(p.x, 0.06 + ind + L * 0.85) * step(0.05, p.y) * step(p.y, 0.97);
        c = mix(uCol, uCol2, step(0.7, h11(seed + 5.0)));
      }
      float dot2 = 1.0 - smoothstep(0.02, 0.045, length((p - vec2(0.9, 0.88)) * a));
      vec3 col = uBg + vec3(0.03) * (1.0 - p.y);
      col = mix(col, c * (0.65 + 0.5 * min(act, 1.2)), on * 0.95);
      col = mix(col, uCol2, dot2 * (0.4 + uFlash));
      col += uCol * uFlash * 0.15;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}

function shellMaterial(pat: 0 | 1, hex: number) {
  return new ShaderMaterial({
    vertexShader: shell.vert,
    fragmentShader: shell.frag,
    uniforms: {
      uColor: { value: new Color('#2f5a14') }, uShade: { value: new Color('#16300a') }, uLit: { value: new Color('#c6ff3d') }, uEvCol: { value: new Color(AMBER) },
      uKey: { value: new Vector3(-0.5, 0.7, 0.55) }, uFill: { value: new Vector3(0.75, 0.1, 0.45) },
      uHex: { value: hex }, uTime: { value: 0 }, uPat: { value: pat }, uEvAge: { value: -1 }, uEvAmt: { value: 0 }, uTalk: { value: 0 }, uIdle: { value: 1 },
    },
  })
}
function screenMaterial(kind: number, aspect: number) {
  return new ShaderMaterial({
    vertexShader: screen.vert,
    fragmentShader: screen.frag,
    uniforms: {
      uBg: { value: new Color('#0d1408') }, uCol: { value: new Color('#c6ff3d') }, uCol2: { value: new Color(AMBER) },
      uTime: { value: 0 }, uKind: { value: kind }, uAct: { value: 0 }, uFlash: { value: 0 }, uAspect: { value: aspect },
    },
  })
}

// A low-poly dome: an icosphere without its lower part (flat facets for the techno shell).
function clippedIco(detail: number, minY: number): BufferGeometry {
  const src = new IcosahedronGeometry(1, detail).toNonIndexed()
  const pos = src.getAttribute('position')
  const keep: number[] = []
  for (let i = 0; i < pos.count; i += 3) {
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
    if (cy > minY) for (let k = 0; k < 3; k++) keep.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k))
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(keep), 3))
  g.computeVertexNormals()
  src.dispose()
  return g
}

// Body numbers per character. shell: ellipsoid radii and centre; hip: x, front z, back z, y; leg: limb
// length; head: scale and neck joint; hex: pattern density; lean: resting body pitch.
export type Spec4 = {
  shell: { sx: number; sy: number; sz: number; y: number; z: number }
  hipX: number; hipF: number; hipB: number; hipY: number; leg: number; legR: number
  neckY: number; neckZ: number; head: number; tail: number; pat: 0 | 1; hex: number; lean: number
  screens: { x: number; z: number; w: number; h: number; kind: number }[]
  lamps: number
}
export const specs4: Record<Turtle, Spec4> = {
  n: { shell: { sx: 0.98, sy: 0.74, sz: 1.0, y: 0.76, z: -0.12 }, hipX: 0.56, hipF: 0.5, hipB: -0.62, hipY: 0.5, leg: 0.3, legR: 0.17, neckY: 0.66, neckZ: 0.88, head: 1.08, tail: -1.08, pat: 0, hex: 4.6, lean: 0,
    screens: [{ x: -0.56, z: -0.3, w: 0.46, h: 0.34, kind: 0 }, { x: 0, z: -0.2, w: 0.46, h: 0.34, kind: 1 }, { x: 0.56, z: -0.3, w: 0.46, h: 0.34, kind: 2 }], lamps: 6 },
  o: { shell: { sx: 0.98, sy: 0.64, sz: 1.1, y: 0.8, z: -0.15 }, hipX: 0.58, hipF: 0.5, hipB: -0.7, hipY: 0.54, leg: 0.4, legR: 0.145, neckY: 0.72, neckZ: 0.82, head: 1.0, tail: -1.2, pat: 0, hex: 4.0, lean: 0,
    screens: [{ x: -0.42, z: -0.2, w: 0.56, h: 0.38, kind: 0 }, { x: 0.42, z: -0.3, w: 0.56, h: 0.38, kind: 2 }], lamps: 6 },
  p: { shell: { sx: 0.76, sy: 0.5, sz: 1.35, y: 0.72, z: -0.2 }, hipX: 0.5, hipF: 0.62, hipB: -0.82, hipY: 0.52, leg: 0.42, legR: 0.12, neckY: 0.62, neckZ: 1.05, head: 0.94, tail: -1.5, pat: 0, hex: 5.4, lean: 0.07,
    screens: [{ x: 0, z: 0.4, w: 0.8, h: 0.26, kind: 1 }], lamps: 4 },
  q: { shell: { sx: 1.1, sy: 0.64, sz: 1.12, y: 0.74, z: -0.14 }, hipX: 0.64, hipF: 0.52, hipB: -0.62, hipY: 0.46, leg: 0.26, legR: 0.18, neckY: 0.6, neckZ: 0.86, head: 1.0, tail: -1.15, pat: 1, hex: 4.4, lean: 0.03,
    screens: [{ x: -0.42, z: -0.2, w: 0.42, h: 0.3, kind: 2 }, { x: 0.44, z: -0.3, w: 0.44, h: 0.3, kind: 1 }], lamps: 5 },
}

// A point on the shell ellipsoid (x, z in body space) with its outward normal, for the screens.
const _q = new Quaternion(), _n = new Vector3(), _z = new Vector3(0, 0, 1)
export function onShell(s: Spec4['shell'], x: number, z: number): { pos: [number, number, number]; quat: [number, number, number, number] } {
  const u = (x / s.sx) ** 2 + ((z - s.z) / s.sz) ** 2
  const y = s.y + s.sy * Math.sqrt(Math.max(0, 1 - u))
  _n.set(x / s.sx ** 2, (y - s.y) / s.sy ** 2, (z - s.z) / s.sz ** 2).normalize()
  _q.setFromUnitVectors(_z, _n)
  return { pos: [x, y - 0.004, z], quat: [_q.x, _q.y, _q.z, _q.w] }
}

export function makeKit4(variant: Turtle) {
  const spec = specs4[variant]
  const geo: BufferGeometry[] = []
  const g = <T extends BufferGeometry>(x: T) => (geo.push(x), x)
  const matte = (o: { rim?: number; spec?: number; sss?: number } = {}) => clayMaterial({ rim: o.rim ?? 0.14, spec: o.spec ?? 0.1, specPow: 18, sss: o.sss ?? 0.08 })
  const lime = matte({ sss: 0.12 }), cream = matte({ sss: 0.05 }), graphite = clayMaterial({ rim: 0.18, spec: 0.22, specPow: 30, sss: 0 })
  const amber = matte(), mint = matte()
  const light = clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.4 })
  const glass = clayMaterial({ rim: 0.3, spec: 0.3, specPow: 30, sss: 0, opacity: 0.4 })
  glass.transparent = true
  const lamps = Array.from({ length: 8 }, () => clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.3 }))
  const shellM = shellMaterial(spec.pat, spec.hex)
  const scr = { s0: screenMaterial(0, 1.3), s1: screenMaterial(1, 1.3), s2: screenMaterial(2, 1.3), phone: screenMaterial(2, 0.55), laptop: screenMaterial(3, 1.5), wide: screenMaterial(1, 3) }
  const shadow = blobMaterial(), shadow2 = blobMaterial()
  const face = glyphMaterial({ mode: 1, mask: [0, 0, 0.34, 0.34], maskR: 0.1, round: 0, line: 0.011 })
  const visor = variant === 'o' ? glyphMaterial({ mode: 0, mask: [0, 0.07, 0.4, 0.125], maskR: 0.1, round: 1, halo: [30, 0.35] }) : null
  const mouthCap = variant === 'o' ? glyphMaterial({ mode: 1, mask: [0, -0.17, 0.2, 0.1], maskR: 0.04, round: 0, line: 0.011 }) : null
  const geos = {
    shell: variant === 'o' ? g(clippedIco(1, -0.2)) : g(new SphereGeometry(1, 64, 40, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    faceCap: g(new SphereGeometry(0.503, 48, 24, 0, Math.PI * 2, 0, 1.0).rotateX(Math.PI / 2)),
    visorCap: g(new SphereGeometry(0.508, 48, 24, 0, Math.PI * 2, 0, 1.0).rotateX(Math.PI / 2)),
  }
  const all: ShaderMaterial[] = [lime, cream, graphite, amber, mint, light, glass, ...lamps, shellM, ...Object.values(scr), shadow, shadow2, face, ...(visor ? [visor] : []), ...(mouthCap ? [mouthCap] : [])]
  return {
    variant, spec, geos, face, visor, mouthCap, shell: shellM, scr, lamps, shadow, shadow2,
    mats: { lime, cream, graphite, amber, mint, light, glass },
    timed: [shellM, ...Object.values(scr)],
    dispose() {
      geo.forEach((x) => x.dispose())
      all.forEach((m) => m.dispose())
    },
  }
}
export type Kit4 = ReturnType<typeof makeKit4>

// Colours from the palette. The shell is a deep green so the lime lines read as the site's accent.
export function paint4(kit: Kit4, p: Palette) {
  const accent = new Color(p.accent), ink = new Color(p.ink), cream = new Color(p.cream)
  const set = (m: ShaderMaterial, col: Color, sh: Color, rim: Color) => {
    const u = uni(m)
    u.uColor!.value.copy(col)
    u.uShade!.value.copy(sh)
    u.uRim!.value.copy(rim)
    u.uSss?.value.copy(col)
  }
  const m = kit.mats
  set(m.lime, accent, accent.clone().lerp(ink, p.dark ? 0.3 : 0.4), accent.clone().lerp(cream, 0.5))
  set(m.cream, cream, cream.clone().lerp(ink, 0.2).lerp(accent, 0.08), cream)
  const gph = ink.clone().lerp(cream, 0.1)
  set(m.graphite, gph, ink, gph.clone().lerp(cream, 0.25))
  const amb = new Color(AMBER), mnt = new Color(MINT)
  set(m.amber, amb, amb.clone().lerp(ink, 0.4), amb.clone().lerp(cream, 0.5))
  set(m.mint, mnt, mnt.clone().lerp(ink, 0.4), mnt.clone().lerp(cream, 0.5))
  set(m.light, accent, accent, accent)
  set(m.glass, mnt.clone().lerp(cream, 0.5), mnt, cream)
  kit.lamps.forEach((l, i) => {
    const c = i % 3 === 1 ? amb : i % 3 === 2 ? mnt : accent
    set(l, c, c, c)
  })
  const s = uni(kit.shell)
  s.uColor!.value.copy(accent.clone().lerp(ink, p.dark ? 0.8 : 0.78))
  s.uShade!.value.copy(ink.clone().lerp(accent, 0.1))
  s.uLit!.value.copy(accent)
  for (const sc of Object.values(kit.scr)) {
    uni(sc).uCol!.value.copy(accent)
    uni(sc).uBg!.value.copy(ink.clone().lerp(cream, 0.04))
  }
  for (const f of [kit.face, kit.visor, kit.mouthCap]) {
    if (!f) continue
    uni(f).uBg!.value.copy(ink.clone().lerp(cream, 0.07))
    uni(f).uInk!.value.copy(ink)
  }
  uni(kit.shadow).uColor!.value.set(p.dark ? p.accent : p.ink)
  uni(kit.shadow).uAlpha!.value = p.dark ? 0.24 : 0.22
  uni(kit.shadow2).uColor!.value.set(p.dark ? p.accent : p.ink)
  uni(kit.shadow2).uAlpha!.value = p.dark ? 0.1 : 0.08
}

export const colors4 = { amber: AMBER, mint: MINT }
