'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Quaternion, Vector3, type Group, type Mesh } from 'three'
import { readPalette, palettes } from '@/lib/fira/palette'
import { clampLook, stepSpring, type Emotion } from '@/lib/fira/pose'
import { blink3, blinkLen3, channels3, springFor, tempo3, type T3 } from '@/lib/fira/pose3'
import { EYE_HALF5, SEGMENTS, adjustLift5, detail5, earLift5, feel5, flash5, rig5, segmentGlow, targets5, tintHex, type Turtle5 } from '@/lib/fira/turtle5'
import { nextFidget } from '@/lib/fira/turtle'
import { driveGlyph, type FaceSpec3 } from './fira-kit3'
import { makeKit5, paint5 } from './fira-kit5'
import { uni } from './materials'

// Round five: one standing rig for R, S, T and U. Springs per channel (pose3 channels, tuned in turtle5.ts),
// soft limbs that blend into the body (overlapping matte volumes, no joints), reach targets for the arm
// (wave, point, chin, glasses, headphone cup), the shell lamps and a head that follows pointer and scroll.
export type Scene5Props = {
  variant: Turtle5
  emotion: Emotion
  lookAt?: boolean
  mouth?: number
  theme?: 'light' | 'dark'
  clock?: number
  spin?: number
  ctx?: string
  active: boolean
  onReady?: () => void
}
type Live = Omit<Scene5Props, 'variant' | 'theme' | 'active' | 'onReady'>
const BASE_YAW = 0.85
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const face5: FaceSpec3 = { sep: 0.165, y: 0.05, w: EYE_HALF5, h: EYE_HALF5, mouthY: -0.15, mouthW: 0.085, brow: [0.1, 0.05], look: [0.07, 0.05] }
const { head: H, body: B, shell: SH, leg: LG, arm: AR } = rig5
const SHOULDER = new Vector3(-AR.x, AR.y, 0.05)
const REST = new Vector3(-AR.x - 0.2, AR.y - 0.62, 0.12)
const CUP_REST = new Vector3(-0.38, 1.6, 0.3), CUP_EAR = new Vector3(-0.66, H.y - 0.02, 0.04)
const lerp3 = (out: Vector3, a: Vector3, b: Vector3, k: number) => out.copy(a).lerp(b, k)

function Rig({ variant, live, theme, onReady }: { variant: Turtle5; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit = useMemo(() => makeKit5(variant), [variant])
  useEffect(() => () => kit.dispose(), [kit])
  const d = detail5[variant]
  const pal = useRef({ light: palettes.light.accent, accent: palettes.light.accent })
  useEffect(() => {
    const apply = () => {
      const p = theme ? palettes[theme] : readPalette()
      paint5(kit, p)
      pal.current = { light: p.accent, accent: p.accent }
    }
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const S = useRef({
    sp: Object.fromEntries(channels3.map((c) => [c, { x: targets5.idle[c], v: 0 }])) as Record<keyof T3, { x: number; v: number }>,
    P: { ...targets5.idle }, hand: { x: 0, v: 0 }, ear: { x: 0, v: 0 }, adj: { x: 0, v: 0 }, wave: { x: 0, v: 0 }, point: { x: 0, v: 0 }, chin: { x: 0, v: 0 }, armB: { x: 0, v: 0 },
    t: 0, ph: 0, next: 2.4, bt: -1, dbl: false, prev: 'idle' as Emotion, px: 0, py: 0, mo: 0,
    fid: { at: 7, kind: 'look' as string, t: -1, dir: 1 }, sv: 0, sy: 0, ready: false,
    seg: new Array<number>(SEGMENTS).fill(0), segC: Array.from({ length: SEGMENTS }, () => new Color('#c6ff3d')),
  })
  const turn = useRef<Group>(null), lean = useRef<Group>(null), sq = useRef<Group>(null), head = useRef<Group>(null), tail = useRef<Group>(null)
  const armA = useRef<Group>(null), armB = useRef<Group>(null), handA = useRef<Group>(null), handB = useRef<Group>(null)
  const cup = useRef<Group>(null), pearl = useRef<Mesh>(null), halo = useRef<Mesh>(null), glints = useRef<(Mesh | null)[]>([null, null])
  const shadowA = useRef<Mesh>(null), shadowB = useRef<Mesh>(null)
  const tmp = useRef({ q: new Quaternion(), down: new Vector3(0, -1, 0), v: new Vector3(), a: new Vector3(), b: new Vector3(), c: new Vector3() })

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
    let lastY = window.scrollY
    const scroll = () => {
      S.current.sv += (window.scrollY - lastY) * 0.02
      lastY = window.scrollY
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', scroll, { passive: true })
    document.addEventListener('mouseout', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', scroll)
      document.removeEventListener('mouseout', leave)
    }
  }, [dom])

  // Aims an arm group (hanging down from its shoulder) at a point in body space, stretching it to reach.
  const reach = (arm: Group, hand: Group | null, from: Vector3, to: Vector3) => {
    const T = tmp.current
    T.v.copy(to).sub(from)
    const len = T.v.length()
    arm.quaternion.setFromUnitVectors(T.down, T.v.normalize())
    const ext = Math.min(1.55, Math.max(0.6, len / AR.len))
    arm.scale.y = ext
    if (hand) {
      hand.scale.set(1, 1 / ext, 1)
    }
  }

  useFrame((state, dtRaw) => {
    const s = S.current, L = live.current, T = tmp.current
    const dt = Math.min(dtRaw, 0.05)
    const cam = state.camera
    cam.position.z += (6.6 - cam.position.z) * (1 - Math.exp(-dt * 5))
    cam.position.y = 1.9 + 0.12 * (cam.position.z - 4)
    cam.lookAt(0, 1.33, 0)
    s.t += dt
    const fixed = L.clock !== undefined
    const clock = L.clock ?? s.t
    const em = L.emotion
    const tg = targets5[em]
    const P = s.P
    const sub = fixed ? 8 : 1
    for (let i = 0; i < sub; i++) {
      for (const c of channels3) {
        const [k, z] = springFor(c, em)
        P[c] = stepSpring(s.sp[c], tg[c], dt, k, z)
      }
    }
    if (s.prev !== em) {
      if (em === 'surprised') s.sp.lift.v += 0.6
      s.prev = em
    }
    let ear = 0, adj = 0, wv = 0, pt = 0, chin = 0, lift = 0
    const scr = em === 'thinking' ? 1 : 0
    for (let i = 0; i < sub; i++) {
      ear = stepSpring(s.ear, earLift5(variant, em), dt, 55, 0.85)
      adj = stepSpring(s.adj, adjustLift5(variant, em), dt, 55, 0.85)
      wv = stepSpring(s.wave, P.wave > 0.5 ? 1 : 0, dt, 60, 0.8)
      pt = stepSpring(s.point, P.arm > 0.5 ? 1 : 0, dt, 60, 0.8)
      chin = stepSpring(s.chin, scr && !d.glasses ? 1 : scr ? 0.8 : 0, dt, 60, 0.8)
      lift = stepSpring(s.armB, em === 'happy' || em === 'wave' ? 1 : em === 'surprised' ? 0.8 : 0, dt, 50, 0.7)
    }
    const hz = tempo3[em] * feel5.tempo
    s.ph = fixed ? clock * hz : s.ph + dt * hz
    const breath = Math.sin(s.ph * Math.PI * 2) * P.breath * 1.3

    const wgt = L.lookAt ? P.pointer * feel5.gaze : 0
    s.px += (ptr.current.x * wgt - s.px) * (1 - Math.exp(-dt * 4))
    s.py += (ptr.current.y * wgt - s.py) * (1 - Math.exp(-dt * 4))
    s.sv *= Math.exp(-dt * 3)
    s.sy += (Math.max(-1, Math.min(1, s.sv)) - s.sy) * (1 - Math.exp(-dt * 6))

    let m = L.mouth ?? 0
    if (L.mouth === undefined && em === 'talking') m = clamp01(0.45 + 0.45 * Math.sin(clock * 9.5) * Math.sin(clock * 3.3 + 1) + 0.1)
    s.mo += (m - s.mo) * (1 - Math.exp(-dt * (m > s.mo ? 22 : 10)))

    if (!fixed) {
      if (s.bt < 0 && s.t >= s.next) {
        s.bt = 0
        s.dbl = Math.random() < feel5.double
      }
      if (s.bt >= 0) {
        s.bt += dt
        if (s.bt > blinkLen3(s.dbl)) {
          s.bt = -1
          s.next = s.t + feel5.blink[0] + (feel5.blink[1] - feel5.blink[0]) * Math.random()
        }
      }
      const f = s.fid
      if (f.t < 0 && s.t >= f.at && (em === 'idle' || em === 'listening')) {
        const nf = nextFidget('n', Math.random(), Math.random())
        f.kind = nf.kind
        f.dir = Math.random() < 0.5 ? -1 : 1
        f.t = 0
        f.at = s.t + nf.delay
      }
      if (f.t >= 0) {
        f.t += dt / 1.8
        if (f.t > 1) f.t = -1
      }
    }
    const blink = em === 'sleep' ? 0 : s.bt >= 0 ? blink3(s.bt, s.dbl) : 0
    const fk = s.fid.t >= 0 ? Math.sin(Math.PI * s.fid.t) : 0
    const fid = s.fid.kind

    const tn = turn.current, ln = lean.current, q = sq.current, hd = head.current
    if (!tn || !ln || !q || !hd) return
    tn.rotation.y = BASE_YAW + (L.spin ? s.t * L.spin : 0) + P.yaw * 0.6
    // Chill: a slow weight shift side to side and a slight lean back.
    const sway = Math.sin(clock * 0.5) * 0.03 + Math.sin(clock * 0.31 + 1) * 0.015
    ln.position.set(Math.sin(clock * 0.5) * 0.015, P.lift * 1.6, 0)
    ln.rotation.set(P.lean * 0.4, 0, P.roll * 0.5 + sway + (fid === 'shift' ? fk * 0.05 * s.fid.dir : 0))
    const sy = P.squash * (1 + breath * 0.5)
    q.scale.set(1 / Math.sqrt(Math.max(sy, 0.2)), sy, 1 / Math.sqrt(Math.max(sy, 0.2)))

    const yaw = -0.3 - P.yaw * 0.8 + P.headRoll * -0.4 + s.px * 0.9 + (fid === 'look' ? fk * 0.5 * s.fid.dir : 0)
    hd.position.set(0, H.y + breath * 0.3, 0.03)
    hd.rotation.set(P.head * 1.1 + P.lean * 0.3 - s.py * 0.4 + s.sy * 0.3 + (em === 'sleep' ? 0.15 : 0) + (fid === 'look' ? fk * -0.08 : 0), yaw, P.headRoll * 0.9 - s.px * 0.08 + ear * -0.12)

    const Pv = { ...P, smile: P.smile + 0.4, lookX: P.lookX + s.px * 0.6 - (yaw + 0.3 + P.yaw * 0.8) * 0.2, lookY: P.lookY + s.py * 0.6 }
    driveGlyph(kit.face, face5, Pv, blink, s.mo, pal.current, {})

    // Arm A (the one nearer the camera) reaches; arm B rests and lifts a little when happy.
    const a = armA.current, b = armB.current
    if (a) {
      const sw = Math.sin(clock * 0.5 + 1) * 0.03
      const T1 = T.a.copy(REST).add(T.c.set(sw, 0, 0))
      const g = (x: number, y: number, z: number, w: number) => w > 0.001 && T1.lerp(T.b.set(x, y, z), Math.min(w, 1))
      g(-0.6, 2.3, 0.3, chin * (1 - adj))
      g(-0.82 + Math.sin(clock * 5.2) * 0.14, 2.42, 0.2, wv)
      g(-0.95, 1.75, 0.72, pt)
      g(-0.3, H.y + 0.05 + Math.sin(clock * 9) * 0.015, 0.56, adj)
      g(CUP_EAR.x - 0.02, CUP_EAR.y - 0.1, CUP_EAR.z + 0.02, ear)
      g(-0.62, 1.55, 0.3, 0.35 * lift)
      reach(a, handA.current, SHOULDER, T1)
    }
    if (b) {
      const R = T.a.set(AR.x + 0.2, AR.y - 0.62, 0.12 + Math.sin(clock * 0.5) * 0.03).lerp(T.b.set(0.7, 1.55, 0.35), lift * 0.6)
      reach(b, handB.current, T.c.set(AR.x, AR.y, 0.05), R)
    }
    // Headphone cup rides to the ear with the hand.
    const cp = cup.current
    if (cp) {
      lerp3(T.a, CUP_REST, CUP_EAR, ear)
      cp.position.copy(T.a)
      cp.rotation.set(0, 0.9 * (1 - ear) + 0 * ear, 0)
    }
    if (tail.current) tail.current.rotation.y = Math.sin(clock * (fid === 'tail' ? 9 : 1.2)) * (fid === 'tail' ? 0.5 * fk : 0.08)

    // Pearl and lens glints.
    const pulse = 0.5 + 0.5 * Math.sin(clock * 1.6)
    const pg = 0.35 + P.glow * 0.55 + pulse * 0.2
    uni(kit.mats.light).uGlow!.value = pg
    uni(kit.mats.halo).uGlow!.value = 0.4 + pg * 0.5
    if (pearl.current) pearl.current.scale.setScalar(1 + pulse * 0.06 + s.mo * 0.12)
    if (halo.current) halo.current.scale.setScalar(1 + pulse * 0.18 + s.mo * 0.4)
    const fl = flash5(em, clock) + adj * 0.5
    uni(kit.mats.glint).uGlow!.value = 0.15 + fl * 0.85
    glints.current.forEach((gm) => gm?.scale.set(1 + fl * 0.8, 1 + fl * 1.2, 1))

    // Shell lamps (T): lit segments ease in and out.
    const su = uni(kit.shell)
    const want = d.segments ? segmentGlow(em, L.ctx) : []
    for (let i = 0; i < SEGMENTS; i++) {
      const w = want.find((x) => x.seg === i)
      const tgt = w ? w.amt * (0.8 + 0.2 * Math.sin(clock * 1.4 + i * 1.3)) : 0
      s.seg[i] = (s.seg[i] ?? 0) + (tgt - (s.seg[i] ?? 0)) * (fixed ? 1 : 1 - Math.exp(-dt * 4))
      if (w) s.segC[i]!.set(w.tint === 'lime' ? pal.current.accent : tintHex[w.tint])
      su.uSegA!.value[i] = s.seg[i]
      su.uSeg!.value[i].copy(s.segC[i]!)
    }

    const k = 1 - Math.min(Math.max(P.lift * 1.6, 0) * 0.5, 0.3)
    shadowA.current?.scale.set(0.95 * k, 0.8 * k, 1)
    shadowB.current?.scale.set(1.6 * k, 1.3 * k, 1)

    if (!s.ready) {
      s.ready = true
      onReady?.()
    }
  })

  const { mats, geos } = kit
  return (
    <group>
      <mesh ref={shadowB} material={kit.shadow2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -0.1]}><circleGeometry args={[1, 40]} /></mesh>
      <mesh ref={shadowA} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}><circleGeometry args={[1, 40]} /></mesh>
      <group ref={turn}>
        <group ref={lean}>
          <group ref={sq}>
            {/* shell: medium dome on the back, tilted up and back; the lime pearl on its crown */}
            <group position={[0, SH.y, SH.z]} rotation={[SH.tilt, 0, 0]}>
              <mesh geometry={geos.shell} material={kit.shell} scale={[SH.rx, SH.ry, SH.rz]} />
              <group position={[0, SH.ry * 1.02, 0]}>
                <mesh ref={halo} material={mats.halo}><sphereGeometry args={[rig5.pearl.r * 1.9, 20, 14]} /></mesh>
                <mesh ref={pearl} material={mats.light}><sphereGeometry args={[rig5.pearl.r, 24, 16]} /></mesh>
              </group>
            </group>

            {/* body: a soft pear with a cream belly; legs and tail are overlapping volumes of the same clay */}
            <mesh material={mats.lime} position={[0, B.y, 0]} scale={[B.rx, B.ry, B.rz]}><sphereGeometry args={[1, 40, 28]} /></mesh>
            <mesh material={mats.lime} position={[0, B.y - 0.3, 0]} scale={[B.rx * 1.04, 0.42, B.rz * 1.04]}><sphereGeometry args={[1, 36, 20]} /></mesh>
            <mesh material={mats.cream} position={[0, B.y - 0.04, 0.12]} scale={[0.43, 0.56, 0.42]}><sphereGeometry args={[1, 48, 32]} /></mesh>
            <group ref={tail} position={[0, 0.62, -0.46]}>
              <mesh material={mats.lime} rotation={[-Math.PI / 2 - 0.4, 0, 0]} position={[0, 0, -0.1]}><coneGeometry args={[0.14, 0.4, 16]} /></mesh>
            </group>
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * LG.x, LG.y, 0.02]}>
                <mesh material={mats.lime} position={[0, -0.3, 0]}><capsuleGeometry args={[LG.r, 0.3, 6, 16]} /></mesh>
                <mesh material={mats.lime} position={[0, -0.58, 0.1]} scale={[1.05, 0.55, 1.55]}><sphereGeometry args={[0.22, 20, 14]} /></mesh>
              </group>
            ))}

            {/* neck blend, then the head */}
            <mesh material={mats.lime} position={[0, 1.82, 0.02]} scale={[0.4, 0.3, 0.38]}><sphereGeometry args={[1, 24, 16]} /></mesh>

            {/* arms: shoulder bulb, tapered capsule, mitten hand; the hand is un-stretched with the arm */}
            {[-1, 1].map((sx) => (
              <group key={sx}>
                <mesh material={mats.lime} position={[sx * AR.x * 0.95, AR.y, 0.05]}><sphereGeometry args={[AR.r * 1.55, 20, 14]} /></mesh>
                <group ref={sx < 0 ? armA : armB} position={[sx * AR.x, AR.y, 0.05]}>
                  <mesh material={mats.lime} position={[0, -AR.len * 0.42, 0]} scale={[1.1, 1, 1.1]}><capsuleGeometry args={[AR.r, AR.len * 0.62, 6, 14]} /></mesh>
                  <group ref={sx < 0 ? handA : handB} position={[0, -AR.len, 0]}>
                    <mesh material={mats.lime} scale={[1.05, 1, 1.05]}><sphereGeometry args={[AR.r * 1.3, 18, 12]} /></mesh>
                  </group>
                </group>
              </group>
            ))}

            {/* headphones resting on the neck: band round the back, two cups hanging on the chest */}
            {d.headphones ? (
              <group>
                <mesh material={mats.graphite} position={[0, 1.68, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.46, 0.4, 1]}><torusGeometry args={[1, 0.11, 10, 44]} /></mesh>
                <group position={[-CUP_REST.x, CUP_REST.y, CUP_REST.z]} rotation={[0, -0.9, 0]}>
                  <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.12, 24]} /></mesh>
                  <mesh material={mats.light} rotation={[0, 0, Math.PI / 2]} position={[0.065, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.02, 20]} /></mesh>
                </group>
                <group ref={cup} position={[CUP_REST.x, CUP_REST.y, CUP_REST.z]}>
                  <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.12, 24]} /></mesh>
                  <mesh material={mats.light} rotation={[0, 0, Math.PI / 2]} position={[-0.065, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.02, 20]} /></mesh>
                </group>
              </group>
            ) : null}

            {/* head: soft sphere, the face glyph (eyes, brows, mouth), glasses */}
            <group ref={head}>
              <group scale={H.r / 0.5}>
                <mesh material={mats.lime}><sphereGeometry args={[0.5, 56, 40]} /></mesh>
                <mesh geometry={geos.faceCap} material={kit.face} renderOrder={2} />
                {d.glasses ? (
                  <group position={[0, 0.05, 0.505]}>
                    {[-1, 1].map((sx, i) => (
                      <group key={sx} position={[sx * 0.17, 0, 0]}>
                        <mesh material={mats.graphite}><torusGeometry args={[0.108, 0.014, 10, 36]} /></mesh>
                        <mesh material={mats.glass} position={[0, 0, -0.004]}><circleGeometry args={[0.105, 28]} /></mesh>
                        <mesh ref={(el) => void (glints.current[i] = el)} material={mats.glint} position={[-0.045, 0.05, 0.004]} rotation={[0, 0, 0.7]} scale={[1, 1, 1]}><capsuleGeometry args={[0.009, 0.045, 4, 8]} /></mesh>
                        <mesh material={mats.glint} position={[-0.015, 0.07, 0.004]}><sphereGeometry args={[0.01, 8, 6]} /></mesh>
                        <mesh material={mats.graphite} position={[sx * 0.14, 0, -0.16]} rotation={[0, Math.PI / 2 + sx * 0.12, 0]}><cylinderGeometry args={[0.009, 0.009, 0.34, 6]} /></mesh>
                      </group>
                    ))}
                    <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.011, 0.06, 4, 8]} /></mesh>
                  </group>
                ) : null}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function FiraScene5({ variant, emotion, lookAt, mouth, theme, active, clock, spin, ctx, onReady }: Scene5Props) {
  const live = useRef<Live>({ emotion, lookAt, mouth, clock, spin, ctx })
  useEffect(() => {
    live.current = { emotion, lookAt, mouth, clock, spin, ctx }
  })
  return (
    <Canvas
      data-fira-canvas=""
      dpr={[1, 1.5]}
      resize={{ offsetSize: true }}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 3.0, 7.2], fov: 27 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      aria-hidden="true"
    >
      <Rig variant={variant} live={live} theme={theme} onReady={onReady} />
    </Canvas>
  )
}
