'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { readPalette, palettes } from '@/lib/fira/palette'
import { clampLook, stepSpring, type Emotion, type RoundThree } from '@/lib/fira/pose'
import { blink3, blinkLen3, channels3, nextBlink3, springFor, target3, tempo3, type T3 } from '@/lib/fira/pose3'
import { driveGlyph, makeKit3, paint3, L_BODY } from './fira-kit3'
import { uni } from './materials'
import type { SceneProps } from './fira-scene'

// Round three (I to M, «взрослая милота»): one frame loop, five figures. Springs settle (no jelly),
// breathing is 4 to 8 s, blinks every 3 to 6 s with an occasional double blink, the head tilts toward
// the pointer. Acting is eye geometry, lid angle, posture, light and tempo (pose3.ts).
type Live = Pick<SceneProps, 'emotion' | 'lookAt' | 'mouth' | 'clock' | 'spin'>
type Perf = { n: number; ms: number }
const GROUND = -1.72
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function Rig({ variant, live, theme, onReady }: { variant: RoundThree; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit = useMemo(() => makeKit3(variant), [variant])
  useEffect(() => () => kit.dispose(), [kit])
  const pal = useRef({ accent: palettes.light.accent, light: palettes.light.accent })

  useEffect(() => {
    const apply = () => {
      const p = theme ? palettes[theme] : readPalette()
      paint3(kit, p)
      pal.current = { accent: p.accent, light: p.accent }
    }
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const S = useRef({
    sp: Object.fromEntries(channels3.map((c) => [c, { x: target3(variant, 'idle')[c], v: 0 }])) as Record<keyof T3, { x: number; v: number }>,
    P: { ...target3(variant, 'idle') }, t: 0, ph: 0, next: 2.4, bt: -1, dbl: false, prev: 'idle' as Emotion,
    px: 0, py: 0, mo: 0, ant: { x: 0, v: 0 }, ready: false,
  })
  const root = useRef<Group>(null), turn = useRef<Group>(null), lean = useRef<Group>(null), sq = useRef<Group>(null)
  const head = useRef<Group>(null), arm = useRef<Group>(null), ant = useRef<Group>(null), zRoot = useRef<Group>(null)
  const haloM = useRef<Mesh>(null), shadowA = useRef<Mesh>(null), shadowB = useRef<Mesh>(null)

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

  const spec = kit.spec
  const pivot = variant === 'i' ? 1.1 + spec.hover : variant === 'm' ? 0.95 + spec.hover : 0

  useFrame((_, dtRaw) => {
    const w = window as unknown as { __firaPerf?: Perf }
    const t0 = w.__firaPerf ? performance.now() : 0
    const s = S.current, L = live.current
    const dt = Math.min(dtRaw, 0.05)
    s.t += dt
    const clock = L.clock ?? s.t
    const em = L.emotion
    const tg = target3(variant, em)
    const P = s.P
    for (const c of channels3) {
      const [k, z] = springFor(c, em)
      P[c] = stepSpring(s.sp[c], tg[c], dt, k, z)
    }
    if (s.prev !== em) {
      if (em === 'surprised') s.sp.lift.v += 0.6
      s.prev = em
    }
    const hz = tempo3[em]
    s.ph = L.clock !== undefined ? clock * hz : s.ph + dt * hz
    const breath = Math.sin(s.ph * Math.PI * 2) * P.breath

    const wgt = L.lookAt ? P.pointer : 0
    s.px += (ptr.current.x * wgt - s.px) * (1 - Math.exp(-dt * 4))
    s.py += (ptr.current.y * wgt - s.py) * (1 - Math.exp(-dt * 4))

    let m = L.mouth ?? 0
    if (L.mouth === undefined && em === 'talking') m = clamp01(0.45 + 0.45 * Math.sin(clock * 9.5) * Math.sin(clock * 3.3 + 1) + 0.1)
    s.mo += (m - s.mo) * (1 - Math.exp(-dt * (m > s.mo ? 22 : 10)))

    if (L.clock === undefined) {
      if (s.bt < 0 && s.t >= s.next) {
        s.bt = 0
        s.dbl = nextBlink3(Math.random(), Math.random()).double
      }
      if (s.bt >= 0) {
        s.bt += dt
        if (s.bt > blinkLen3(s.dbl)) {
          s.bt = -1
          s.next = s.t + nextBlink3(Math.random(), 1).delay
        }
      }
    }
    const blink = em === 'sleep' ? 0 : s.bt >= 0 ? blink3(s.bt, s.dbl) : 0

    const r = root.current, tn = turn.current, ln = lean.current, q = sq.current
    if (!r || !tn || !ln || !q) return
    const sc = spec.scale
    const float = spec.hover ? Math.sin(s.ph * Math.PI * 2 + 0.6) * 0.035 : 0
    r.scale.setScalar(sc)
    r.position.set(0, GROUND, 0)
    tn.rotation.y = L.spin ? s.t * L.spin : 0
    const sway = Math.sin(clock * 0.45) * 0.014 * (1 - clamp01(P.zzz))
    const rock = Math.sin(clock * 2.4) * 0.075 * P.wave
    const yaw = P.yaw + s.px * 0.32
    const hasHead = variant === 'j' || variant === 'l'
    ln.position.set(0, pivot + P.lift * 2 + float, 0)
    ln.rotation.set(P.lean + (hasHead ? 0 : P.head * 0.45) - s.py * (hasHead ? 0.04 : 0.1), hasHead ? yaw * 0.3 : yaw, P.roll + sway + rock + (hasHead ? 0 : P.headRoll * 0.5) - s.px * 0.04)
    const sy = P.squash * (1 + breath)
    const sxz = 1 / Math.sqrt(Math.max(sy, 0.2))
    q.scale.set(sxz, sy, sxz)
    if (head.current) {
      head.current.rotation.set(P.head - s.py * 0.18, yaw * 0.7, P.headRoll - s.px * 0.06)
    }

    // Face: the gaze follows the pointer a little on top of the emotion's look.
    const Pv = { ...P, lookX: P.lookX + s.px * 0.7, lookY: P.lookY + s.py * 0.6 }
    if (variant === 'k') Pv.eyeY += s.mo * 0.55 * Math.sin(clock * 7)
    driveGlyph(kit.face3, kit.face, Pv, blink, s.mo, pal.current, { pulse: variant === 'i' ? 0.28 : variant === 'j' ? 0.3 : 0 })

    if (variant === 'k' && ant.current) {
      // The antenna lags the body on a soft secondary spring and bends toward what she points at.
      const want = -(P.roll + rock) * 1.4 - P.arm * 0.35 + P.lean * 0.6
      stepSpring(s.ant, want, dt, 70, 0.45)
      ant.current.rotation.z = s.ant.x
      ant.current.rotation.x = -P.lean * 0.8
      uni(kit.mats.light).uGlow!.value = 0.12 + P.glow * 0.5 + s.mo * 0.2
      uni(kit.halo).uAlpha!.value = 0.12 + P.glow * 0.4
      haloM.current?.scale.setScalar(0.16 + P.glow * 0.1)
    }
    if (variant === 'l' && arm.current) {
      const a = Math.max(P.arm, P.wave * 0.85)
      arm.current.visible = a > 0.02
      arm.current.scale.set(a, a, a)
      arm.current.rotation.z = P.arm * 0.32 + P.wave * (1.05 + Math.sin(clock * 2.6) * 0.22) - (1 - a) * 0.8
    }

    // Contact shadow: a tight core and a wide soft one; smaller when she rises.
    const k = 1 - Math.min(Math.max(P.lift * 2 + float + spec.hover * 0.5, 0) * 0.5, 0.4)
    shadowA.current?.scale.set(0.8 * spec.shadow * k, 0.8 * spec.shadow * k, 1)
    shadowB.current?.scale.set(1.3 * spec.shadow * k, 1.3 * spec.shadow * k, 1)

    for (let i = 0; i < 3; i++) {
      const g = zRoot.current?.children[i], zm = kit.zMats[i]
      if (!g || !zm) continue
      const ph = (clock * 0.22 + i / 3) % 1
      const a = Math.sin(Math.PI * ph) * clamp01(P.zzz) * 0.55
      g.position.set(spec.zz[0] + ph * 0.28, spec.zz[1] - 0.3 + ph * 0.7, 0.2)
      g.scale.setScalar(0.5 + ph * 0.5)
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

  const { geos, mats, face3 } = kit
  let body: React.ReactNode = null
  if (variant === 'i') {
    body = (
      <group position={[0, spec.hover, 0]}>
        <mesh geometry={geos.body} material={mats.lime} />
        <mesh geometry={geos.visor} material={face3} renderOrder={2} />
      </group>
    )
  } else if (variant === 'j') {
    body = (
      <>
        <group position={[0, 0.36, 0]}>
          <mesh geometry={geos.stem} material={mats.lime} />
          <group ref={head} position={[0, 0.66, 0]}>
            <group position={[0, 0.5, 0]}>
              <mesh geometry={geos.head} material={mats.lime} />
              <group>
                <mesh geometry={geos.lens} material={mats.graphite} scale={0.997} />
                <mesh geometry={geos.lens} material={face3} renderOrder={2} />
              </group>
            </group>
          </group>
        </group>
      </>
    )
  } else if (variant === 'k') {
    body = (
      <group position={[0, 0.85, 0]}>
        <mesh geometry={geos.body} material={mats.lime} />
        <mesh geometry={geos.screen} material={face3} position={[0, 0.02, 0.312]} renderOrder={2} />
        <group ref={ant} position={[0.42, 0.84, 0]}>
          <mesh geometry={geos.stem} material={mats.graphite} />
          <mesh ref={haloM} geometry={geos.disc} material={kit.halo} position={[0, 0.3, -0.02]} />
          <mesh geometry={geos.ball} material={mats.light} position={[0, 0.3, 0]} />
        </group>
      </group>
    )
  } else if (variant === 'l') {
    body = (
      <>
        <mesh geometry={geos.body} material={mats.cream} />
        <mesh geometry={geos.collar} material={mats.graphite} position={[0, L_BODY - 0.02, 0]} />
        <group ref={arm} position={[0.2, L_BODY - 0.32, 0.02]} visible={false}>
          <mesh geometry={geos.arm} material={mats.cream} />
        </group>
        <group ref={head} position={[0, L_BODY, 0]}>
          <group position={[0, 0.44, 0]}>
            <mesh geometry={geos.head} material={mats.lime} />
            <mesh geometry={geos.face} material={face3} renderOrder={2} />
          </group>
        </group>
      </>
    )
  } else {
    body = (
      <group position={[0, 0.95 + spec.hover, 0]} scale={[1, 1, 0.36]}>
        <mesh geometry={geos.body} material={mats.lime} />
        <mesh geometry={geos.face} material={face3} renderOrder={2} />
      </group>
    )
  }

  return (
    <group ref={root} scale={spec.scale} position={[0, GROUND, 0]}>
      <mesh ref={shadowB} geometry={geos.disc} material={kit.shadow2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} renderOrder={0} />
      <mesh ref={shadowA} geometry={geos.disc} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={0} />
      <group ref={turn}>
        {/* J's base stays planted while the stem and head lean. */}
        {variant === 'j' ? <mesh geometry={geos.base} material={mats.cream} /> : null}
        <group ref={lean}>
          <group ref={sq} position={[0, 0, 0]}>
            <group position={[0, -pivot, 0]}>{body}</group>
          </group>
        </group>
        <group ref={zRoot}>
          {[0, 1, 2].map((i) => (
            <group key={i} visible={false}>
              <mesh geometry={geos.zbar} material={kit.zMats[i]} position={[0, 0.11, 0]} />
              <mesh geometry={geos.zbar} material={kit.zMats[i]} position={[0, -0.11, 0]} />
              <mesh geometry={geos.zdiag} material={kit.zMats[i]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function FiraScene3({ variant, emotion, lookAt, mouth, theme, active, clock, spin, onReady }: SceneProps) {
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
      <Rig variant={variant as RoundThree} live={live} theme={theme} onReady={onReady} />
    </Canvas>
  )
}
