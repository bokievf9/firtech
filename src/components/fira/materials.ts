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
        p += n * (d * 0.045 + e * 0.014) * uDisp;
        n = normalize(n - (g * 0.045 + ge * 0.014) * uDisp * 0.6);
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
    uniform float uAspect; uniform float uSpark;
    varying vec2 vUv;
    float ell(vec2 p, vec2 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-4); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      vec2 r = vec2(0.8 * uAspect, 0.8 * max(uOpen, 0.07));
      float d = ell(p, r);
      d = max(d, p.y - r.y * (1.0 - 2.0 * uLid));
      float shift = mix(3.2, uThick, smoothstep(0.0, 1.0, uMoon));
      vec2 q = p - vec2(0.0, -uDir * shift);
      d = max(d, -(length(q) - 0.8));
      float w = fwidth(d) * 1.3 + 1e-4;
      float a = 1.0 - smoothstep(-w, w, d);
      float spark = 1.0 - smoothstep(0.0, 0.03, length(p - vec2(-0.28, 0.3) * vec2(uAspect, 1.0)) - 0.2);
      spark = max(spark, 1.0 - smoothstep(0.0, 0.03, length(p - vec2(0.26, -0.28)) - 0.09));
      vec3 col = mix(uInk, uCream, spark * uSpark * (1.0 - uMoon) * step(0.3, uOpen) * (1.0 - uLid * 0.9));
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

const c = (hex: string) => new Color(hex)

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
  mats: { body: ShaderMaterial[]; ink: ShaderMaterial[]; cream: ShaderMaterial[]; strong: ShaderMaterial[]; mark: ShaderMaterial[] },
  eyes: ShaderMaterial[],
  p: Palette,
) {
  const accent = c(p.accent), ink = c(p.ink), cream = c(p.cream), strong = c(p.strong), mark = c(p.mark)
  const shade = accent.clone().lerp(ink, 0.34)
  const set = (m: ShaderMaterial, col: Color, sh: Color, rim: Color) => {
    m.uniforms.uColor.value.copy(col)
    m.uniforms.uShade.value.copy(sh)
    m.uniforms.uRim.value.copy(rim)
  }
  const rimBody = accent.clone().lerp(cream, 0.55)
  for (const m of mats.body) set(m, accent, shade, m.userData.rimCream ? cream : rimBody)
  for (const m of mats.strong) set(m, strong, strong.clone().lerp(ink, 0.3), rimBody)
  for (const m of mats.ink) set(m, ink, ink.clone().lerp(accent, 0.12), ink.clone().lerp(accent, 0.25))
  for (const m of mats.cream) set(m, cream, cream.clone().lerp(accent, 0.28), cream)
  for (const m of mats.mark) set(m, mark, mark, mark)
  for (const m of eyes) {
    m.uniforms.uInk.value.copy(ink)
    m.uniforms.uCream.value.copy(cream)
  }
}
