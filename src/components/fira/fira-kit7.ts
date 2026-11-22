import { BackSide, Color, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import type { Palette } from '@/lib/fira/palette'
import { rig7 } from '@/lib/fira/turtle7'
import { limb, makeKit6, paint6 } from './fira-kit6'
import { uni } from './materials'

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

export function makeKit7() {
  const k = makeKit6()
  const ol = new ShaderMaterial({ vertexShader: outline.vert, fragmentShader: outline.frag, side: BackSide, uniforms: { uColor: { value: new Color('#1f5a12') }, uW: { value: 0.017 } } })
  const plastron = new ShaderMaterial({
    vertexShader: plate.vert, fragmentShader: plate.frag,
    uniforms: { uColor: { value: new Color('#fbeab0') }, uShade: { value: new Color('#e8cf84') }, uLine: { value: new Color('#e3bd62') }, uKey: { value: new Vector3(-0.5, 0.7, 0.55) } },
  })
  const geo = { arm: limb(rig7.arm.len, 0.12, 0.103, 0.112, 0.5), sphere: new SphereGeometry(1, 40, 28) }
  return {
    ...k, ol, plastron, geos: { ...k.geos, ...geo },
    dispose() {
      k.dispose()
      geo.arm.dispose()
      geo.sphere.dispose()
      ol.dispose()
      plastron.dispose()
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
  set(kit.mats.lime, '#a6ef42', '#74cb28', '#d3fb7c', '#c9fb62')
  set(kit.mats.cream, '#f6e7a8', '#e4cc82', '#fff6c8')
  set(kit.mats.graphite, '#2b3a2a', '#141f14', '#4b6a46')
  set(kit.pad, '#243224', '#101810', '#3a5a36')
  const s = uni(kit.shell)
  s.uColor!.value.set('#2f9f68')
  s.uShade!.value.set('#1c6a46')
  s.uLit!.value.set('#63dc9c')
  s.uSeam!.value = 0.85
  uni(kit.face).uBg!.value.set('#ffffff')
  uni(kit.face).uInk!.value.set('#1d2c18')
  uni(kit.face).uLC!.value = 0.12 // a drooping, curved lid like the reference
  uni(kit.face).uScl!.value = 1 // pale eye white round the dark iris
  uni(kit.blush).uColor!.value.set('#c8a257')
  uni(kit.blush).uAlpha!.value = p.dark ? 0.75 : 0.85
  uni(kit.ol).uColor!.value.set(p.dark ? '#143a0e' : '#1f5a12')
  uni(kit.shadow).uColor!.value.set(p.dark ? '#000000' : '#0d1408')
  uni(kit.shadow).uAlpha!.value = p.dark ? 0.4 : 0.2
  uni(kit.shadow2).uColor!.value.set(p.dark ? '#000000' : '#0d1408')
  uni(kit.shadow2).uAlpha!.value = p.dark ? 0.2 : 0.08
}
