'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Mesh, ShaderMaterial } from 'three'
import { readPalette, palettes, type Palette } from '@/lib/fira/palette'
import {
  BLINK_LEN, blinkClosed, blinkDelay, breathHz, channels, clampLook, feel, hopCurve, makeSprings,
  stepSpring, targets, volumeXZ, type Emotion, type RoundOne, type Variant,
} from '@/lib/fira/pose'
import { makeKit, onSurface, type Kit } from './fira-kit'
import { paint, uni } from './materials'

export type SceneProps = {
  variant: Variant
  emotion: Emotion
  lookAt: boolean
  mouth?: number
  theme?: 'light' | 'dark'
  active: boolean
  clock?: number
  /** Turntable: radians per second around the vertical axis (0 or undefined: off). */
  spin?: number
  onReady?: () => void
}

type Live = Pick<SceneProps, 'emotion' | 'lookAt' | 'mouth' | 'clock' | 'spin'>
type Perf = { n: number; ms: number }

const mix = (a: number, b: number, k: number) => a + (b - a) * k
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function Rig({ variant, live, theme, onReady }: { variant: Variant; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit: Kit = useMemo(() => makeKit(variant as RoundOne), [variant])
  useEffect(() => () => kit.dispose(), [kit])

  // Palette: live from the site's CSS variables (and again when <html data-theme> changes), or the
  // fixed table for a forced theme.
  useEffect(() => {
    const pal = (t?: 'light' | 'dark'): Palette => {
      const p = t ? palettes[t] : readPalette()
      kit.zMats.forEach((m) => {
        uni(m).uColor!.value.set(p.mark)
        uni(m).uShade!.value.set(p.mark)
      })
      uni(kit.shadow).uColor!.value.set(p.dark ? p.accent : p.ink)
      uni(kit.shadow).uAlpha!.value = p.dark ? 0.22 : 0.2
      uni(kit.blush).uColor!.value.set(p.blush)
      uni(kit.halo).uColor!.value.set(p.strong)
      return p
    }
    const apply = () => paint(kit.mats, [kit.eye], pal(theme))
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const { spec, geos } = kit
  const S = useRef({ sp: makeSprings(targets.idle), t: 0, ph: 0, nextBlink: 2.2, blinkT: -1, prev: 'idle' as Emotion, px: 0, py: 0, ptx: 0, pty: 0, mo: 0, ant: { x: 0, v: 0 }, ready: false })

  const root = useRef<Group>(null), head = useRef<Group>(null), sq = useRef<Group>(null), eyes = useRef<Group>(null)
  const smileM = useRef<Mesh>(null), mouthM = useRef<Mesh>(null), armR = useRef<Group>(null), armL = useRef<Group>(null)
  const handR = useRef<Mesh>(null), handL = useRef<Mesh>(null), earL = useRef<Group>(null), earR = useRef<Group>(null)
  const ant = useRef<Group>(null), dot = useRef<Mesh>(null), haloM = useRef<Mesh>(null), inner = useRef<Mesh>(null), tuft = useRef<Group>(null)
  const shadowM = useRef<Mesh>(null), blushL = useRef<Mesh>(null), blushR = useRef<Mesh>(null)
  const zRoot = useRef<Group>(null)

  // Pointer: offset from the figure's centre, kept in a ref (never React state).
  const ptr = useRef({ x: 0, y: 0 })
  const dom = useThree((st) => st.gl.domElement)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = dom.getBoundingClientRect()
      if (!r.width) return
      const l = clampLook((e.clientX - (r.left + r.width / 2)) / r.width, (e.clientY - (r.top + r.height / 2)) / r.height)
      ptr.current = { x: l.x, y: -l.y }
    }
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) ptr.current = { x: 0, y: 0 }
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('mouseout', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('mouseout', leave)
    }
  }, [dom])

  const place = useMemo(() => {
    const e = spec.eye
    const lift = variant === 'c' ? 0.04 : variant === 'a' ? 0.03 : 0.004
    const phi = Math.asin(Math.min(0.95, e.x / spec.profile.r(e.y)))
    return {
      eyeL: onSurface(spec.profile, e.y, -phi, 0.014 + lift),
      eyeR: onSurface(spec.profile, e.y, phi, 0.014 + lift),
      mouth: onSurface(spec.profile, spec.mouthY, 0, 0.004 + lift),
      cheekL: onSurface(spec.profile, spec.cheek.y, -Math.asin(spec.cheek.x / spec.profile.r(spec.cheek.y)), 0.01 + lift),
      cheekR: onSurface(spec.profile, spec.cheek.y, Math.asin(spec.cheek.x / spec.profile.r(spec.cheek.y)), 0.01 + lift),
    }
  }, [spec, variant])

  useFrame((_, dtRaw) => {
    const w = window as unknown as { __firaPerf?: Perf }
    const t0 = w.__firaPerf ? performance.now() : 0
    const s = S.current, L = live.current
    const dt = Math.min(dtRaw, 0.05)
    s.t += dt
    const clock = L.clock ?? s.t
    const em = L.emotion
    const tg = targets[em]
    for (const c of channels) {
      const f = feel[c]
      stepSpring(s.sp[c], tg[c], dt, f?.[0] ?? 140, f?.[1] ?? 0.85)
    }
    const P = s.sp
    if (s.prev !== em) {
      P.squash.v += em === 'happy' ? -2.6 : -1.4
      s.prev = em
    }
    s.ph = L.clock !== undefined ? clock * breathHz[em] : s.ph + dt * breathHz[em]
    const breath = Math.sin(s.ph * Math.PI * 2) * P.breath.x

    // Pointer follow, limited by the emotion's weight.
    const wgt = L.lookAt ? tg.pointer : 0
    s.ptx = L.lookAt ? ptr.current.x * wgt : 0
    s.pty = L.lookAt ? ptr.current.y * wgt : 0
    s.px += (s.ptx - s.px) * (1 - Math.exp(-dt * 9))
    s.py += (s.pty - s.py) * (1 - Math.exp(-dt * 9))

    // Hop, squash and stretch.
    const hop = P.hop.x > 0.02 ? hopCurve(clock) : { y: 0, sy: 1 }
    const hopK = clamp01(P.hop.x)
    const sy = P.squash.x * mix(1, hop.sy, hopK) * (1 + breath)
    const sxz = volumeXZ(sy)

    // Mouth: the prop (lip-sync) wins, talking falls back to a synthetic envelope.
    let m = L.mouth ?? 0
    if (L.mouth === undefined && em === 'talking') {
      m = clamp01(0.5 + 0.5 * Math.sin(clock * 11.5) * Math.sin(clock * 4.1 + 1) + 0.12)
    }
    s.mo += (m - s.mo) * (1 - Math.exp(-dt * (m > s.mo ? 28 : 12)))

    // Blink every 3 to 6 s (never in stills).
    if (L.clock === undefined) {
      if (s.blinkT < 0 && s.t >= s.nextBlink) s.blinkT = 0
      if (s.blinkT >= 0) {
        s.blinkT += dt
        if (s.blinkT > BLINK_LEN) {
          s.blinkT = -1
          s.nextBlink = s.t + blinkDelay(Math.random())
        }
      }
    }
    const closed = s.blinkT >= 0 ? blinkClosed(s.blinkT) : 0
    const open = clamp01(P.open.x) * (1 - closed)

    const r = root.current, h = head.current, q = sq.current
    if (!r || !h || !q) return
    r.position.set(P.lean.x * 0.2, -1.38 * spec.scale + hop.y * 0.5 * hopK, 0)
    r.rotation.z = -P.lean.x
    r.rotation.y = L.spin ? s.t * L.spin : 0
    q.scale.set(sxz, sy, sxz)
    h.rotation.set(P.pitch.x - s.py * 0.2 + breath * 0.5 + s.mo * 0.03, s.px * 0.34 + Math.sin(clock * 0.6) * 0.03 * (1 - clamp01(P.zzz.x)), P.roll.x + s.px * -0.05)

    // Eyes.
    const eg = eyes.current
    if (eg) eg.position.set(P.lookX.x * 0.07 + s.px * 0.06, P.lookY.x * 0.06 + s.py * 0.05, 0)
    const u = uni(kit.eye)
    const moon = P.moon.x
    u.uOpen!.value = Math.max(open, 0.07)
    u.uLid!.value = spec.eye.lid
    const arch = (spec.eye.arch ?? 0) * clamp01(P.open.x)
    u.uMoon!.value = moon >= 0 ? Math.max(Math.min(1, moon), arch) : Math.min(1, -moon)
    u.uThick!.value = moon >= 0 ? (0.17) : 0.12
    u.uDir!.value = moon >= 0 ? 1 : -1

    // Mouth and smile.
    const sm = smileM.current, mo = mouthM.current
    const mvis = clamp01(s.mo * 7)
    if (sm) {
      const k = clamp01(P.smile.x) * (1 - mvis)
      sm.scale.set(k * (1 + P.smile.x * 0.3), k, k)
      sm.visible = k > 0.02
    }
    if (mo) {
      mo.scale.set(mix(1, 0.8, s.mo) * mvis, mix(0.2, 1.05, s.mo) * mvis, mvis)
      mo.visible = mvis > 0.02
    }
    const bk = clamp01(P.blush.x) * spec.cheek.k
    uni(kit.blush).uAlpha!.value = 0.75 * bk
    if (blushL.current) blushL.current.visible = bk > 0.02
    if (blushR.current) blushR.current.visible = bk > 0.02

    // Glow: slow pulse while thinking, follows the voice while talking.
    const pulse = em === 'thinking' ? 0.5 + 0.5 * Math.sin(clock * Math.PI * 1.6) : 1
    const glow = P.glow.x * pulse + s.mo * 0.4

    // Arms.
    const ar = armR.current, al = armL.current
    if (ar && al) {
      const wig = Math.sin(clock * 9) * 0.16 * P.cheer.x
      const a = -1.1 + P.arm.x * 1.35 + P.cheer.x * 2.15 + wig
      const len = 0.8 + P.arm.x * 0.4 + P.cheer.x * 0.35
      ar.rotation.z = a + P.wave.x * (2.5 + Math.sin(clock * 8.5) * 0.4)
      ar.scale.set(len, 1, 1)
      al.rotation.z = Math.PI - (-1.1 + P.cheer.x * 2.15 - wig)
      al.scale.set(0.8 + P.cheer.x * 0.35, 1, 1)
      if (handR.current) handR.current.position.x = 0.46 * len
      if (handL.current) handL.current.position.x = 0.46 * (0.8 + P.cheer.x * 0.35)
    }

    // Ears (B) and tuft (C).
    if (earL.current && earR.current) {
      const e = P.ear.x, sp = P.earSplit.x
      const wob = Math.sin(clock * 10) * 0.12 * P.cheer.x
      const eL = e + sp * 0.6, eR = e - sp * 0.9
      const ang = (v: number) => 0.62 - 0.45 * v + 0.95 * Math.max(-v, 0)
      earL.current.rotation.z = ang(eL) - s.px * 0.2 + wob
      earR.current.rotation.z = -ang(eR) - s.px * 0.2 - wob
      earL.current.scale.y = 1 + 0.25 * Math.max(eL, 0)
      earR.current.scale.y = 1 + 0.25 * Math.max(eR, 0)
    }
    if (tuft.current) tuft.current.rotation.z = Math.sin(clock * 1.1) * 0.08 - P.roll.x * 0.5 + P.lean.x * -0.4

    // Antenna (A): a secondary spring lags the body so the dot jiggles.
    if (ant.current) {
      stepSpring(s.ant, -(P.roll.x * 1.1 + P.lean.x * 1.4) - hop.y * 0.0, dt, 60, 0.25)
      s.ant.v += (sy - 1) * -0.6
      ant.current.rotation.z = s.ant.x + Math.sin(clock * 1.3) * 0.04
      const dg = 0.35 + glow * 0.9
      uni(kit.m.strong).uGlow!.value = dg * 0.5
      uni(kit.halo).uAlpha!.value = 0.18 + glow * 0.5
      if (dot.current) dot.current.scale.setScalar(1 + glow * 0.18)
      if (haloM.current) haloM.current.scale.setScalar(0.34 + glow * 0.16)
    }
    // Light body (B): the inner glow breathes.
    if (inner.current) {
      const m2 = inner.current.material as ShaderMaterial
      uni(m2).uGlow!.value = 0.08 + glow * 0.35
    }
    if (variant === 'c') uni(kit.m.body).uGlow!.value = glow * 0.12
    for (const b of kit.mats.body) uni(b).uTime!.value = clock

    // Shadow shrinks with the hop.
    if (shadowM.current) {
      const k = 1 - Math.min(hop.y * hopK * 0.5, 0.5)
      shadowM.current.scale.set(1.05 * k * sxz, 1.05 * k * sxz, 1)
    }

    // Zzz: three letters rising in turn while asleep.
    for (let i = 0; i < 3; i++) {
      const g = zRoot.current?.children[i], zm = kit.zMats[i]
      if (!g || !zm) continue
      const ph = (clock * 0.32 + i / 3) % 1
      const a = Math.sin(Math.PI * ph) * clamp01(P.zzz.x)
      g.position.set(0.62 + ph * 0.32 + Math.sin(ph * 6) * 0.04, 0.95 + ph * 0.95, 0.2)
      g.scale.setScalar((0.55 + ph * 0.7) * (0.6 + 0.4 * clamp01(P.zzz.x)))
      uni(zm).uOpacity!.value = a
      g.visible = a > 0.01
    }

    if (!s.ready) {
      s.ready = true
      onReady?.()
    }
    if (w.__firaPerf) {
      w.__firaPerf.n++
      w.__firaPerf.ms += performance.now() - t0
    }
  })

  const top = spec.profile.top
  const isA = variant === 'a', isB = variant === 'b', isC = variant === 'c'
  const eyeScale = spec.eye.s
  const arm = isB ? kit.m.strong : kit.m.body
  return (
    <group ref={root} scale={spec.scale} position={[0, -1.38 * spec.scale, 0]}>
      <mesh ref={shadowM} geometry={geos.disc} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={1.05} renderOrder={0} />
      <group ref={sq}>
        <group position={[0, 1, 0]}>
          <group ref={head}>
            {isB ? (
              <>
                <mesh ref={inner} geometry={geos.inner} material={kit.m.core} />
                <mesh geometry={geos.body} material={kit.m.body} renderOrder={1} />
              </>
            ) : (
              <mesh geometry={geos.body} material={kit.m.body} />
            )}

            <group ref={eyes}>
              {[place.eyeL, place.eyeR].map((pl, i) => (
                <mesh key={i} geometry={geos.plane} material={kit.eye} position={pl.position} quaternion={pl.quaternion} scale={[eyeScale, eyeScale, 1]} renderOrder={3} />
              ))}
            </group>
            {[place.cheekL, place.cheekR].map((pl, i) => (
              <mesh key={i} ref={i ? blushR : blushL} geometry={geos.plane} material={kit.blush} position={pl.position} quaternion={pl.quaternion} scale={[0.23, 0.15, 1]} renderOrder={2} />
            ))}
            <group position={place.mouth.position} quaternion={place.mouth.quaternion}>
              <mesh ref={smileM} geometry={geos.smile} material={kit.m.ink} position={[0, 0.07, 0]} scale={[0.55, 0.55, 0.6]} />
              <mesh ref={mouthM} geometry={geos.mouth} material={kit.m.ink} scale={[1, 0.2, 0.4]} />
            </group>

            {isA ? (
              <group ref={ant} position={[0, top - 0.06, 0]}>
                <mesh geometry={geos.stalk} material={kit.m.ink} position={[0, 0.17, 0]} />
                <mesh ref={haloM} geometry={geos.plane} material={kit.halo} position={[0, 0.4, 0.05]} scale={0.34} renderOrder={4} />
                <mesh ref={dot} geometry={geos.dot} material={kit.m.strong} position={[0, 0.4, 0]} />
              </group>
            ) : null}
            {isB
              ? ([-1, 1] as const).map((sd) => (
                  <group key={sd} ref={sd < 0 ? earL : earR} position={[sd * 0.62, 0.74, 0]}>
                    <group position={[0, 0.2, 0]} scale={[1, 1, 0.62]}>
                      <mesh geometry={geos.ear} material={kit.m.strong} />
                      <mesh geometry={geos.tuft} material={kit.m.cream} position={[0, 0.0, 0.1]} scale={[0.11, 0.17, 0.07]} />
                    </group>
                  </group>
                ))
              : null}
            {isC ? (
              <group ref={tuft} position={[0, 0.97, 0.05]}>
                <mesh geometry={geos.tuft} material={kit.m.body} position={[0, 0.05, 0]} scale={[0.15, 0.2, 0.15]} />
                <mesh geometry={geos.tuft} material={kit.m.body} position={[-0.14, 0, 0]} scale={[0.1, 0.15, 0.1]} rotation={[0, 0, 0.5]} />
                <mesh geometry={geos.tuft} material={kit.m.body} position={[0.14, 0.01, 0]} scale={[0.1, 0.14, 0.1]} rotation={[0, 0, -0.5]} />
              </group>
            ) : null}
          </group>

          {([1, -1] as const).map((sd) => {
            const x = spec.profile.r(-0.05) * 0.96
            return (
              <group key={sd} ref={sd > 0 ? armR : armL} position={[sd * x, -0.08, 0.05]}>
                <mesh geometry={geos.arm} material={arm} />
                <mesh ref={sd > 0 ? handR : handL} geometry={geos.hand} material={arm} position={[0.37, 0, 0]} />
              </group>
            )
          })}

          <group ref={zRoot}>
          {[0, 1, 2].map((i) => (
            <group key={i} visible={false}>
              <mesh geometry={geos.zbar} material={kit.zMats[i]} position={[0, 0.13, 0]} />
              <mesh geometry={geos.zbar} material={kit.zMats[i]} position={[0, -0.13, 0]} />
              <mesh geometry={geos.zdiag} material={kit.zMats[i]} rotation={[0, 0, 0]} />
            </group>
          ))}
          </group>
        </group>
      </group>
    </group>
  )
}

export default function FiraScene({ variant, emotion, lookAt, mouth, theme, active, clock, spin, onReady }: SceneProps) {
  const live = useRef<Live>({ emotion, lookAt, mouth, clock, spin })
  useEffect(() => {
    live.current = { emotion, lookAt, mouth, clock, spin }
  })
  return (
    <Canvas
      data-fira-canvas=""
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0.1, 8.4], fov: 26 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      aria-hidden="true"
    >
      <Rig variant={variant} live={live} theme={theme} onReady={onReady} />
    </Canvas>
  )
}
