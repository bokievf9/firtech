import { Color, DoubleSide, ShaderMaterial, Vector3, AdditiveBlending, NormalBlending } from 'three'
import type { Palette } from '@/lib/fira/palette'

// Three small shaders carry all of Fira: Soft (body, ears, limbs: half-lambert light, a shade that
// leans green, a rim and an optional noise fluff), Eye (an SDF face decal with lid, arches and
// sparkles, anti-aliased) and Blob (a radial glow for blush, shadow and the antenna halo). They
// output sRGB themselves (colorspace_fragment) and skip tone mapping, so the lime stays lime.

const soft = {
  vert: /* glsl */ `
    uniform float uTime; uniform float uDisp;
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec3 p = position; vec3 n = normal;
      if (uDisp > 0.0) {
        float a = p.x * 3.1 + uTime * 0.7, b = p.y * 2.7 - uTime * 0.55, c = p.z * 3.3 + uTime * 0.4;
        float d = sin(a) * sin(b) * sin(c);
        vec3 g = vec3(3.1 * cos(a) * sin(b) * sin(c), 2.7 * sin(a) * cos(b) * sin(c), 3.3 * sin(a) * sin(b) * cos(c));
        float f1 = 15.0, f2 = 17.0, f3 = 13.0;
        float e = sin(p.x * f1 + uTime * 1.3) * sin(p.y * f2 - uTime) * sin(p.z * f3 + uTime * 0.8);
        vec3 ge = vec3(f1 * cos(p.x * f1 + uTime * 1.3) * sin(p.y * f2 - uTime) * sin(p.z * f3 + uTime * 0.8),
                       f2 * sin(p.x * f1 + uTime * 1.3) * cos(p.y * f2 - uTime) * sin(p.z * f3 + uTime * 0.8),
                       f3 * sin(p.x * f1 + uTime * 1.3) * sin(p.y * f2 - uTime) * cos(p.z * f3 + uTime * 0.8));
        p += n * (d * 0.022 + e * 0.008) * uDisp;
        n = normalize(n - (g * 0.022 + ge * 0.008) * uDisp * 0.6);
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * n);
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uRim; uniform vec3 uLight;
    uniform float uRimPow; uniform float uRimAmt; uniform float uSpec; uniform float uGlow;
    uniform float uOpacity; uniform float uAlphaRim;
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec3 n = normalize(vN); vec3 v = normalize(vV);
      float ndl = smoothstep(0.0, 1.0, dot(n, normalize(uLight)) * 0.5 + 0.5);
      vec3 col = mix(uShade, uColor, ndl);
      float fr = pow(1.0 - max(dot(n, v), 0.0), uRimPow);
      col = mix(col, uRim, fr * uRimAmt);
      vec3 h = normalize(normalize(uLight) + v);
      col += pow(max(dot(n, h), 0.0), 40.0) * uSpec;
      col += uColor * uGlow;
      gl_FragColor = vec4(col, uOpacity * mix(1.0, fr, uAlphaRim));
      #include <colorspace_fragment>
    }`,
}

const eye = {
  vert: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  frag: /* glsl */ `
    uniform vec3 uInk; uniform vec3 uCream;
    uniform float uOpen; uniform float uLid; uniform float uMoon; uniform float uThick; uniform float uDir;
    uniform float uAspect; uniform float uSpark; uniform float uScale; uniform vec3 uIris;
    varying vec2 vUv;
    float sdArc(vec2 p, vec2 sc, float ra, float rb) { p.x = abs(p.x); return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb; }
    float ell(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      vec2 r = vec2(0.8 * uAspect, 0.8 * max(uOpen, 0.07)) * uScale;
      float d = ell(p, r);
      d = max(d, p.y - r.y * (1.0 - 2.0 * uLid));
      vec2 q = (p - vec2(0.0, -0.3 * uDir)) * vec2(1.0, uDir);
      float da = sdArc(q, vec2(sin(1.05), cos(1.05)), 0.62 * uAspect, uThick);
      d = mix(d, da, smoothstep(0.0, 1.0, uMoon));
      float w = fwidth(d) * 1.3 + 1e-4;
      float a = 1.0 - smoothstep(-w, w, d);
      float spark = 1.0 - smoothstep(0.0, 0.03, length(p - vec2(-0.28, 0.3) * vec2(uAspect, 1.0)) - 0.2);
      spark = max(spark, 1.0 - smoothstep(0.0, 0.03, length(p - vec2(0.26, -0.28)) - 0.09));
      vec3 base = mix(uInk, uIris, smoothstep(0.1, -0.7, p.y / max(uScale, 0.5)) * 0.55);
      vec3 col = mix(base, uCream, spark * uSpark * (1.0 - uMoon) * step(0.3, uOpen) * (1.0 - uLid * 0.9));
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }`,
}

const blob = {
  vert: eye.vert,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform float uAlpha; uniform float uSoft;
    varying vec2 vUv;
    void main() {
      float d = length(vUv * 2.0 - 1.0);
      float a = (1.0 - smoothstep(uSoft, 1.0, d)); a *= a;
      gl_FragColor = vec4(uColor, a * uAlpha);
      #include <colorspace_fragment>
    }`,
}

// Round two. Clay: three-point soft studio light (warm key with wrap, cool fill, back light that
// feeds the rim), a saturated band at the terminator that fakes subsurface scattering, a darker
// underside (fake AO), a broad matte highlight and a hint of grain. uBend bends the top of a mesh
// sideways (the flame's tip). Lid: a flat body-coloured patch that covers the upper part of an eye
// (separate mesh from the eye so it can tilt). Mouth: five-shape SDF decal, a smile arc or an open
// mouth with a tongue. All output sRGB and skip tone mapping, like Soft.
const clay = {
  vert: /* glsl */ `
    uniform float uBend; uniform float uBendY;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      vec3 p = position;
      float u = max(p.y - uBendY, 0.0);
      p.x += uBend * u * u;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = -mv.xyz;
      vP = position;
      gl_Position = projectionMatrix * mv;
    }`,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uRim; uniform vec3 uSss;
    uniform vec3 uKey; uniform vec3 uFill; uniform vec3 uBack;
    uniform float uRimPow; uniform float uRimAmt; uniform float uSpec; uniform float uGlow;
    uniform float uOpacity; uniform float uAlphaRim; uniform float uSssAmt; uniform float uEdge;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      vec3 n = normalize(vN); vec3 v = normalize(vV);
      float key = clamp((dot(n, normalize(uKey)) + 0.55) / 1.55, 0.0, 1.0);
      float fill = clamp(dot(n, normalize(uFill)) * 0.5 + 0.5, 0.0, 1.0);
      float lit = smoothstep(0.1, 0.96, key * 0.8 + fill * 0.2);
      vec3 col = mix(uShade, uColor, lit);
      float band = exp(-pow((key - 0.4) / 0.2, 2.0));
      col = mix(col, uSss, band * uSssAmt);
      col *= 0.82 + 0.18 * smoothstep(-0.95, 0.35, n.y);
      float fr = pow(1.0 - max(dot(n, v), 0.0), uRimPow);
      float back = clamp(dot(n, normalize(uBack)) * 0.5 + 0.5, 0.0, 1.0);
      col = mix(col, uRim, fr * uRimAmt * (0.35 + 0.65 * back));
      vec3 h = normalize(normalize(uKey) + v);
      col += pow(max(dot(n, h), 0.0), 9.0) * uSpec;
      float g = fract(sin(dot(vP * vec3(91.0, 57.0, 73.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      col *= 0.987 + 0.026 * g;
      col += uColor * uGlow;
      col = mix(col, uShade * 0.6, fr * uEdge);
      gl_FragColor = vec4(col, uOpacity * mix(1.0, fr, uAlphaRim));
      #include <colorspace_fragment>
    }`,
}

const lid = {
  vert: eye.vert,
  frag: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uShade;
    uniform float uLid; uniform float uTilt; uniform float uSide; uniform float uAspect; uniform float uScale; uniform float uOn;
    varying vec2 vUv;
    float ell(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      vec2 r = vec2(0.8 * uAspect, 0.8) * uScale;
      float d = ell(p, r) - 0.07;
      float edgeY = r.y - uLid * 2.0 * r.y + uTilt * uSide * p.x * 0.9;
      float dl = p.y - edgeY;
      float w = fwidth(d) * 1.3 + 1e-4;
      float a = (1.0 - smoothstep(-w, w, d)) * (1.0 - smoothstep(-w, w, -dl)) * uOn;
      float line = 1.0 - smoothstep(0.0, 0.05, abs(dl));
      vec3 col = mix(uColor, uShade * 0.7, line * 0.55);
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }`,
}

const mouth = {
  vert: eye.vert,
  frag: /* glsl */ `
    uniform vec3 uInk; uniform vec3 uTongue;
    uniform float uOpen; uniform float uW; uniform float uH; uniform float uSmile; uniform float uFlat; uniform float uTongueAmt;
    varying vec2 vUv;
    float ell(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      // closed: a smile arc, corners up, depth from uSmile
      float depth = 0.06 + 0.34 * uSmile;
      float wA = 0.62;
      float yc = -depth * (1.0 - (p.x * p.x) / (wA * wA)) + depth * 0.45;
      float slope = 2.0 * depth * p.x / (wA * wA);
      float dA = max(abs(p.y - yc) / sqrt(1.0 + slope * slope), abs(p.x) - wA) - 0.075;
      // open: an ellipse, flat on top for the grin
      vec2 r = vec2(0.7 * uW, 0.7 * max(uH, 0.04));
      vec2 q = p - vec2(0.0, uFlat * r.y * 0.35 - 0.05);
      float dO = ell(q, r);
      dO = mix(dO, max(dO, q.y - r.y * 0.02 + uFlat * r.y * 0.0), uFlat);
      float d = mix(dA, dO, smoothstep(0.0, 0.25, uOpen));
      float w = fwidth(d) * 1.3 + 1e-4;
      float a = 1.0 - smoothstep(-w, w, d);
      float tg = ell(q - vec2(0.0, -r.y * 0.78), vec2(r.x * 0.6, r.y * 0.62));
      float tm = (1.0 - smoothstep(-w, w, tg)) * uTongueAmt * smoothstep(0.3, 0.7, uOpen) * step(0.0, -q.y + r.y * 0.1);
      vec3 col = mix(uInk, uTongue, tm);
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }`,
}

const c = (hex: string) => new Color(hex)

// Uniform bag with loose values (Color, Vector3, number): tuples are typed per material above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Uni = Record<string, { value: any }>
export const uni = (m: ShaderMaterial) => m.uniforms as Uni

export type SoftOpts = { color?: string; rim?: number; rimPow?: number; spec?: number; opacity?: number; alphaRim?: number; disp?: number; glow?: number }

export function softMaterial(o: SoftOpts = {}) {
  const m = new ShaderMaterial({
    vertexShader: soft.vert,
    fragmentShader: soft.frag,
    transparent: (o.opacity ?? 1) < 1 || (o.alphaRim ?? 0) > 0,
    uniforms: {
      uTime: { value: 0 },
      uDisp: { value: o.disp ?? 0 },
      uColor: { value: c('#c6ff3d') },
      uShade: { value: c('#7ac01a') },
      uRim: { value: c('#ffffff') },
      uLight: { value: new Vector3(-0.45, 0.75, 0.62) },
      uRimPow: { value: o.rimPow ?? 2.6 },
      uRimAmt: { value: o.rim ?? 0.3 },
      uSpec: { value: o.spec ?? 0.28 },
      uGlow: { value: o.glow ?? 0 },
      uOpacity: { value: o.opacity ?? 1 },
      uAlphaRim: { value: o.alphaRim ?? 0 },
    },
  })
  m.userData.base = o.color ?? 'accent'
  return m
}

export function eyeMaterial() {
  return new ShaderMaterial({
    vertexShader: eye.vert,
    fragmentShader: eye.frag,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
    uniforms: {
      uInk: { value: c('#0d1408') },
      uCream: { value: c('#f4f1ea') },
      uOpen: { value: 1 },
      uLid: { value: 0 },
      uMoon: { value: 0 },
      uThick: { value: 0.4 },
      uDir: { value: 1 },
      uAspect: { value: 1 },
      uSpark: { value: 1 },
      uScale: { value: 1 },
      uIris: { value: c('#2c4a12') },
    },
  })
}

export function blobMaterial(additive = false) {
  return new ShaderMaterial({
    vertexShader: blob.vert,
    fragmentShader: blob.frag,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
    uniforms: { uColor: { value: c('#000000') }, uAlpha: { value: 0.2 }, uSoft: { value: 0 } },
  })
}

// Paints every material from the palette. Shade = lime pulled toward the ink so shadows stay green.
export function paint(
  mats: { core?: ShaderMaterial[]; body: ShaderMaterial[]; ink: ShaderMaterial[]; cream: ShaderMaterial[]; strong: ShaderMaterial[]; mark: ShaderMaterial[] },
  eyes: ShaderMaterial[],
  p: Palette,
) {
  const accent = c(p.accent), ink = c(p.ink), cream = c(p.cream), strong = c(p.strong), mark = c(p.mark)
  const shade = accent.clone().lerp(ink, p.dark ? 0.2 : 0.34)
  const set = (m: ShaderMaterial, col: Color, sh: Color, rim: Color) => {
    uni(m).uColor!.value.copy(col)
    uni(m).uShade!.value.copy(sh)
    uni(m).uRim!.value.copy(rim)
  }
  const rimBody = accent.clone().lerp(cream, 0.55)
  for (const m of mats.body) set(m, accent, shade, m.userData.rimCream ? cream : rimBody)
  for (const m of mats.strong) set(m, strong, strong.clone().lerp(ink, 0.3), rimBody)
  for (const m of mats.ink) set(m, ink, ink.clone().lerp(accent, 0.12), ink.clone().lerp(accent, 0.25))
  for (const m of mats.cream) set(m, cream, cream.clone().lerp(accent, 0.28), cream)
  for (const m of mats.mark) set(m, mark, mark, mark)
  const core = accent.clone().lerp(cream, 0.62)
  for (const m of mats.core ?? []) set(m, core, accent.clone().lerp(cream, 0.15), accent)
  for (const m of eyes) {
    uni(m).uInk!.value.copy(ink)
    uni(m).uCream!.value.copy(cream)
    uni(m).uIris?.value.copy(ink.clone().lerp(accent, 0.28))
  }
}

export type ClayOpts = SoftOpts & { sss?: number; edge?: number; bend?: number; bendY?: number }

// The round-two body material (see the clay shader above). Same uniform names as Soft where they
// overlap, so `paint` can colour both.
export function clayMaterial(o: ClayOpts = {}) {
  const m = new ShaderMaterial({
    vertexShader: clay.vert,
    fragmentShader: clay.frag,
    transparent: (o.opacity ?? 1) < 1 || (o.alphaRim ?? 0) > 0,
    depthWrite: !((o.alphaRim ?? 0) > 0),
    uniforms: {
      uBend: { value: o.bend ?? 0 },
      uBendY: { value: o.bendY ?? 0 },
      uColor: { value: c('#c6ff3d') },
      uShade: { value: c('#7ac01a') },
      uRim: { value: c('#ffffff') },
      uSss: { value: c('#d8ff4a') },
      uKey: { value: new Vector3(-0.5, 0.7, 0.55) },
      uFill: { value: new Vector3(0.75, 0.1, 0.45) },
      uBack: { value: new Vector3(0.2, 0.55, -0.7) },
      uRimPow: { value: o.rimPow ?? 2.6 },
      uRimAmt: { value: o.rim ?? 0.35 },
      uSpec: { value: o.spec ?? 0.1 },
      uGlow: { value: o.glow ?? 0 },
      uOpacity: { value: o.opacity ?? 1 },
      uAlphaRim: { value: o.alphaRim ?? 0 },
      uSssAmt: { value: o.sss ?? 0.4 },
      uEdge: { value: o.edge ?? 0 },
    },
  })
  m.userData.base = o.color ?? 'accent'
  return m
}

export function lidMaterial(side: number) {
  return new ShaderMaterial({
    vertexShader: lid.vert,
    fragmentShader: lid.frag,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: DoubleSide,
    uniforms: {
      uColor: { value: c('#c6ff3d') },
      uShade: { value: c('#7ac01a') },
      uLid: { value: 0 },
      uTilt: { value: 0 },
      uSide: { value: side },
      uAspect: { value: 1 },
      uScale: { value: 1 },
      uOn: { value: 1 },
    },
  })
}

export function mouthMaterial() {
  return new ShaderMaterial({
    vertexShader: mouth.vert,
    fragmentShader: mouth.frag,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
    uniforms: {
      uInk: { value: c('#0d1408') },
      uTongue: { value: c('#ff9a8a') },
      uOpen: { value: 0 },
      uW: { value: 0.8 },
      uH: { value: 0.05 },
      uSmile: { value: 0.4 },
      uFlat: { value: 0 },
      uTongueAmt: { value: 0 },
    },
  })
}

// Colours for the round-two materials: body lime, a deeper green for leaves, ears and tails, a lighter
// lime for the glowing dot, the shell of the bubble. The body shade leans green, the terminator band
// a saturated yellow-green, lids take the body colour.
export function paintClay(
  m: { bodies: ShaderMaterial[]; deep: ShaderMaterial; ink: ShaderMaterial; cream: ShaderMaterial; dot: ShaderMaterial; shell: ShaderMaterial; lids: ShaderMaterial[]; mouth: ShaderMaterial },
  p: Palette,
) {
  const accent = c(p.accent), ink = c(p.ink), cream = c(p.cream), strong = c(p.strong)
  const shade = accent.clone().lerp(ink, p.dark ? 0.24 : 0.36)
  const sss = accent.clone().lerp(c('#f2ff3a'), 0.4)
  const set = (mat: ShaderMaterial, col: Color, sh: Color, rim: Color, sssC: Color = sss) => {
    uni(mat).uColor!.value.copy(col)
    uni(mat).uShade!.value.copy(sh)
    uni(mat).uRim!.value.copy(rim)
    uni(mat).uSss?.value.copy(sssC)
  }
  const rimBody = accent.clone().lerp(cream, 0.6)
  for (const b of m.bodies) set(b, accent, shade, rimBody)
  const deep = accent.clone().lerp(ink, p.dark ? 0.42 : 0.5)
  set(m.deep, deep, deep.clone().lerp(ink, 0.35), accent.clone().lerp(deep, 0.3), deep.clone().lerp(accent, 0.3))
  set(m.ink, ink, ink.clone().lerp(accent, 0.1), ink.clone().lerp(accent, 0.3), ink)
  set(m.cream, cream, cream.clone().lerp(accent, 0.3), cream, cream.clone().lerp(accent, 0.15))
  const dot = accent.clone().lerp(cream, 0.72)
  set(m.dot, dot, accent.clone().lerp(cream, 0.3), cream, dot)
  const shell = strong.clone().lerp(cream, p.dark ? 0.15 : 0.3)
  set(m.shell, shell, accent.clone().lerp(ink, p.dark ? 0.1 : 0.2), cream.clone().lerp(strong, 0.1), accent)
  for (const l of m.lids) {
    uni(l).uColor!.value.copy(accent.clone().lerp(shade, 0.3))
    uni(l).uShade!.value.copy(shade)
  }
  uni(m.mouth).uInk!.value.copy(ink)
  uni(m.mouth).uTongue!.value.copy(c(p.blush))
}
