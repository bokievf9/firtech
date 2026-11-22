import { Color, ShaderMaterial, SphereGeometry, Vector3, type BufferGeometry } from 'three'
import type { Palette } from '@/lib/fira/palette'
import { SEGMENTS, type Turtle5 } from '@/lib/fira/turtle5'
import { glyphMaterial } from './fira-kit3'
import { blobMaterial, clayMaterial, uni } from './materials'

// Round five kit: the clay materials of round four, one new shell shader (seven scutes, each can glow as
// a lamp, lime seams) and the face glyph. The same kit serves all four variants; the rig decides what is drawn.
const shell = {
  vert: /* glsl */ `
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
    }`,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uLit; uniform vec3 uKey; uniform vec3 uFill;
    uniform vec3 uSeg[${SEGMENTS}]; uniform float uSegA[${SEGMENTS}]; uniform float uSeam;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    const float PI = 3.14159265;
    void main() {
      vec3 n = normalize(vN); vec3 v = normalize(vV);
      float key = clamp((dot(n, normalize(uKey)) + 0.55) / 1.55, 0.0, 1.0);
      float fill = clamp(dot(n, normalize(uFill)) * 0.5 + 0.5, 0.0, 1.0);
      float lit = smoothstep(0.1, 0.96, key * 0.8 + fill * 0.2);
      vec3 o = normalize(vP);
      float th = acos(clamp(o.y, -1.0, 1.0));
      float az = (atan(o.x, o.z) + PI) / (2.0 * PI) * 5.0;
      int id = 0; float f = 0.0; float rr = 0.0;
      if (th > 1.15) { float s2 = az + 0.5; id = 6 + int(mod(floor(s2), 5.0)); f = fract(s2); rr = 1.0; }
      else if (th > 0.5) { id = 1 + int(mod(floor(az), 5.0)); f = fract(az); rr = 1.0; }
      float dSec = min(f, 1.0 - f) * sin(th) * 1.257;
      float d = min(abs(th - 0.5), abs(th - 1.15));
      d = min(d, rr > 0.5 ? dSec : 9.0);
      float w = fwidth(d) * 1.3 + 1e-4;
      float seam = 1.0 - smoothstep(0.03, 0.03 + w, d);
      vec3 base = mix(uShade, uColor, lit);
      float a = clamp(uSegA[id], 0.0, 1.0);
      vec3 sc = uSeg[id];
      vec3 col = mix(base, sc * (0.5 + 0.5 * lit), a * 0.78);
      col = mix(col, uLit * (0.55 + 0.45 * lit), seam * uSeam);
      col += sc * a * seam * 0.45;
      float fr = pow(1.0 - max(dot(n, v), 0.0), 2.6);
      col = mix(col, uLit, fr * 0.1);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}

function shellMaterial(seam: number) {
  return new ShaderMaterial({
    vertexShader: shell.vert,
    fragmentShader: shell.frag,
    uniforms: {
      uColor: { value: new Color('#2f5a14') }, uShade: { value: new Color('#16300a') }, uLit: { value: new Color('#c6ff3d') },
      uKey: { value: new Vector3(-0.5, 0.7, 0.55) }, uFill: { value: new Vector3(0.75, 0.1, 0.45) },
      uSeg: { value: Array.from({ length: SEGMENTS }, () => new Color('#c6ff3d')) }, uSegA: { value: new Array<number>(SEGMENTS).fill(0) }, uSeam: { value: seam },
    },
  })
}

export function makeKit5(variant: Turtle5) {
  const geo: BufferGeometry[] = []
  const g = <T extends BufferGeometry>(x: T) => (geo.push(x), x)
  const matte = (o: { rim?: number; spec?: number; sss?: number } = {}) => clayMaterial({ rim: o.rim ?? 0.14, spec: o.spec ?? 0.1, specPow: 18, sss: o.sss ?? 0.08 })
  const lime = matte({ sss: 0.12 }), cream = matte({ sss: 0.05 }), graphite = clayMaterial({ rim: 0.18, spec: 0.22, specPow: 30, sss: 0 })
  const light = clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.4 })
  const halo = clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.5, opacity: 0.26 })
  halo.depthWrite = false
  const glint = clayMaterial({ rim: 0, spec: 0, sss: 0, glow: 0.3 })
  const glass = clayMaterial({ rim: 0.3, spec: 0.3, specPow: 30, sss: 0, opacity: 0.32 })
  glass.depthWrite = false
  const shellM = shellMaterial(variant === 't' ? 0.7 : 0.5)
  const shadow = blobMaterial(), shadow2 = blobMaterial()
  const face = glyphMaterial({ mode: 1, mask: [0, 0, 0.34, 0.34], maskR: 0.1, round: 0, line: 0.011 })
  const geos = {
    shell: g(new SphereGeometry(1, 64, 40)),
    faceCap: g(new SphereGeometry(0.503, 48, 24, 0, Math.PI * 2, 0, 1.0).rotateX(Math.PI / 2)),
  }
  const all = [lime, cream, graphite, light, halo, glint, glass, shellM, shadow, shadow2, face]
  return {
    variant, geos, face, shell: shellM, shadow, shadow2,
    mats: { lime, cream, graphite, light, halo, glint, glass },
    dispose() {
      geo.forEach((x) => x.dispose())
      all.forEach((m) => m.dispose())
    },
  }
}
export type Kit5 = ReturnType<typeof makeKit5>

export function paint5(kit: Kit5, p: Palette) {
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
  set(m.light, accent, accent, accent)
  set(m.halo, accent, accent, accent)
  set(m.glint, cream, cream, cream)
  set(m.glass, cream.clone().lerp(accent, 0.25), cream.clone().lerp(ink, 0.2), cream)
  const s = uni(kit.shell)
  s.uColor!.value.copy(accent.clone().lerp(ink, p.dark ? 0.8 : 0.78))
  s.uShade!.value.copy(ink.clone().lerp(accent, 0.1))
  s.uLit!.value.copy(accent)
  const f = uni(kit.face)
  f.uBg!.value.copy(ink.clone().lerp(cream, 0.07))
  f.uInk!.value.copy(ink)
  uni(kit.shadow).uColor!.value.set(p.dark ? p.accent : p.ink)
  uni(kit.shadow).uAlpha!.value = p.dark ? 0.24 : 0.22
  uni(kit.shadow2).uColor!.value.set(p.dark ? p.accent : p.ink)
  uni(kit.shadow2).uAlpha!.value = p.dark ? 0.1 : 0.08
}
