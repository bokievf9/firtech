'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3, type Group, type Mesh } from 'three'
import { readPalette, palettes } from '@/lib/fira/palette'
import { clampLook, stepSpring, type Emotion } from '@/lib/fira/pose'
import { blink3, blinkLen3, channels3, springFor, tempo3, type T3 } from '@/lib/fira/pose3'
import { nextFidget } from '@/lib/fira/turtle'
import { BASE_YAW6, EYE_HALF6, bodyYaw6, cupLift6, detail6, feel6, laptopOpen6, lensFlash6, rig6, screenHex6, targets6, type Turtle6 } from '@/lib/fira/turtle6'
import { driveGlyph, type FaceSpec3 } from './fira-kit3'
import { makeKit6, paint6 } from './fira-kit6'
import { uni } from './materials'

// Round six: one standing rig for V, W, X and Y. Limbs are single tapered volumes (lathe) of the body clay,
// the shell is a thin plate hugging the back, the whole body turns toward the pointer (then the head follows
// a little), idle has breathing, weight shifts, small head turns, blinks and a slow look-around cycle.
export type Scene6Props = {
  variant: Turtle6
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
type Live = Omit<Scene6Props, 'variant' | 'theme' | 'active' | 'onReady'>
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const face6: FaceSpec3 = { sep: 0.2, y: 0.04, w: EYE_HALF6, h: EYE_HALF6, mouthY: -0.15, mouthW: 0.075, brow: [0.1, 0.05], look: [0.07, 0.05] }
const { head: H, body: B, shell: SH, leg: LG, arm: AR } = rig6
const SHOULDER = new Vector3(-AR.x, AR.y, 0.05), SHOULDER_B = new Vector3(AR.x, AR.y, 0.05)
const REST = new Vector3(-AR.x - 0.12, AR.y - AR.len, 0.14)
const CUP_REST = new Vector3(-0.3, 1.3, 0.46), CUP_EAR = new Vector3(-0.5, H.y - 0.02, 0.04)
const PRESS = new Vector3(-0.54, H.y - 0.1, 0.1)
const HOLD_A = new Vector3(-0.4, 0.92, 0.8), HOLD_B = new Vector3(0.4, 0.92, 0.8)
const lerp3 = (out: Vector3, a: Vector3, b: Vector3, k: number) => out.copy(a).lerp(b, k)
const cupGeo = [0.12, 0.12, 0.1, 24] as const

function Rig({ variant, live, theme, onReady }: { variant: Turtle6; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit = useMemo(() => makeKit6(), [])
  useEffect(() => () => kit.dispose(), [kit])
  const d = detail6[variant]
  const pal = useRef({ light: palettes.light.accent, accent: palettes.light.accent })
  useEffect(() => {
    const apply = () => {
      const p = theme ? palettes[theme] : readPalette()
      paint6(kit, p)
      pal.current = { light: p.accent, accent: p.accent }
    }
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const S = useRef({
    sp: Object.fromEntries(channels3.map((c) => [c, { x: targets6.idle[c], v: 0 }])) as Record<keyof T3, { x: number; v: number }>,
    P: { ...targets6.idle }, ear: { x: 0, v: 0 }, wave: { x: 0, v: 0 }, point: { x: 0, v: 0 }, chin: { x: 0, v: 0 }, armB: { x: 0, v: 0 }, lap: { x: 0, v: 0 },
    t: 0, ph: 0, next: 2.4, bt: -1, dbl: false, prev: 'idle' as Emotion, px: 0, py: 0, mo: 0, by: BASE_YAW6, lastMove: -99,
    fid: { at: 6, kind: 'look' as string, t: -1, dir: 1 }, sv: 0, sy: 0, ready: false,
  })
  const turn = useRef<Group>(null), lean = useRef<Group>(null), sq = useRef<Group>(null), head = useRef<Group>(null), tail = useRef<Group>(null)
  const armA = useRef<Group>(null), armB = useRef<Group>(null), handA = useRef<Group>(null), handB = useRef<Group>(null)
  const cup = useRef<Group>(null), pearl = useRef<Mesh>(null), halo = useRef<Mesh>(null), glints = useRef<(Mesh | null)[]>([null, null])
  const lapG = useRef<Group>(null), lidG = useRef<Group>(null)
  const shadowA = useRef<Mesh>(null), shadowB = useRef<Mesh>(null)
  const tmp = useRef({ down: new Vector3(0, -1, 0), v: new Vector3(), a: new Vector3(), b: new Vector3(), c: new Vector3(), q: new Quaternion() })

  const ptr = useRef({ x: 0, y: 0 })
  const dom = useThree((st) => st.gl.domElement)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = dom.getBoundingClientRect()
      if (!r.width) return
      const l = clampLook((e.clientX - (r.left + r.width / 2)) / r.width, (e.clientY - (r.top + r.height / 2)) / r.height)
      ptr.current = { x: l.x, y: -l.y }
      S.current.lastMove = S.current.t
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

  // Aims an arm (hanging down from its shoulder) at a point in body space, stretching it to reach; the hand is un-stretched.
  const reach = (arm: Group, hand: Group | null, from: Vector3, to: Vector3) => {
    const T = tmp.current
    T.v.copy(to).sub(from)
    const len = T.v.length()
    arm.quaternion.setFromUnitVectors(T.down, T.v.normalize())
    const ext = Math.min(1.7, Math.max(0.6, len / AR.len))
    arm.scale.y = ext
    hand?.scale.set(1, 1 / ext, 1)
  }

  useFrame((state, dtRaw) => {
    const s = S.current, L = live.current, T = tmp.current
    const dt = Math.min(dtRaw, 0.05)
    const cam = state.camera
    cam.position.z += (6.6 - cam.position.z) * (1 - Math.exp(-dt * 5))
    cam.position.y = 1.65 + 0.12 * (cam.position.z - 4)
    cam.lookAt(0, 1.2, 0)
    s.t += dt
    const fixed = L.clock !== undefined
    const clock = L.clock ?? s.t
    const em = L.emotion
    const tg = targets6[em]
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
    let ear = 0, wv = 0, pt = 0, chin = 0, lift = 0, lap = 0
    for (let i = 0; i < sub; i++) {
      ear = stepSpring(s.ear, cupLift6(variant, em), dt, 55, 0.85)
      wv = stepSpring(s.wave, P.wave > 0.5 ? 1 : 0, dt, 60, 0.8)
      pt = stepSpring(s.point, P.arm > 0.5 ? 1 : 0, dt, 60, 0.8)
      chin = stepSpring(s.chin, em === 'thinking' && !d.laptop ? 1 : 0, dt, 60, 0.8)
      lift = stepSpring(s.armB, em === 'happy' || em === 'wave' ? 1 : em === 'surprised' ? 0.8 : 0, dt, 50, 0.7)
      lap = stepSpring(s.lap, laptopOpen6(variant, em), dt, 38, 0.8)
    }
    const hz = tempo3[em] * feel6.tempo
    s.ph = fixed ? clock * hz : s.ph + dt * hz
    const breath = Math.sin(s.ph * Math.PI * 2) * P.breath * 1.5

    const follow = Boolean(L.lookAt) && em !== 'sleep'
    const wgt = follow ? P.pointer * feel6.gaze : 0
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
        s.dbl = Math.random() < feel6.double
      }
      if (s.bt >= 0) {
        s.bt += dt
        if (s.bt > blinkLen3(s.dbl)) {
          s.bt = -1
          s.next = s.t + feel6.blink[0] + (feel6.blink[1] - feel6.blink[0]) * Math.random()
        }
      }
      const f = s.fid
      if (f.t < 0 && s.t >= f.at && (em === 'idle' || em === 'listening')) {
        const nf = nextFidget('n', Math.random(), Math.random())
        f.kind = nf.kind
        f.dir = Math.random() < 0.5 ? -1 : 1
        f.t = 0
        f.at = s.t + feel6.fidget[0] + (feel6.fidget[1] - feel6.fidget[0]) * Math.random()
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
    // The whole body turns: toward the pointer while it moves, otherwise a slow look-around cycle.
    const want = em === 'sleep' ? BASE_YAW6 : bodyYaw6(ptr.current.x, s.t - s.lastMove, clock, follow)
    s.by = fixed ? want : s.by + (want - s.by) * (1 - Math.exp(-dt * 2.4))
    tn.rotation.y = s.by + (L.spin ? s.t * L.spin : 0) + P.yaw * 0.4
    const sway = Math.sin(clock * 0.5) * 0.03 + Math.sin(clock * 0.31 + 1) * 0.015
    ln.position.set(Math.sin(clock * 0.5) * 0.02, P.lift * 1.6, 0)
    ln.rotation.set(P.lean * 0.4, 0, P.roll * 0.5 + sway + (fid === 'shift' ? fk * 0.05 * s.fid.dir : 0))
    const sy = P.squash * (1 + breath * 0.5)
    q.scale.set(1 / Math.sqrt(Math.max(sy, 0.2)), sy, 1 / Math.sqrt(Math.max(sy, 0.2)))

    const lag = want - s.by
    const yaw = -P.yaw * 0.5 - P.headRoll * 0.3 + lag * 0.9 + s.px * 0.3 + Math.sin(clock * 0.7) * 0.1 + (fid === 'look' ? fk * 0.5 * s.fid.dir : 0)
    hd.position.set(0, H.y + breath * 0.3, 0.03)
    hd.rotation.set(P.head * 1.1 + P.lean * 0.3 - s.py * 0.4 + s.sy * 0.3 + Math.sin(clock * 0.43) * 0.03 + (em === 'sleep' ? 0.15 : 0) + (fid === 'look' ? fk * -0.08 : 0), yaw, P.headRoll * 0.9 - s.px * 0.08)

    const Pv = { ...P, smile: P.smile + 0.4, lookX: P.lookX + s.px * 0.5 - lag * 0.25, lookY: P.lookY + s.py * 0.6 }
    driveGlyph(kit.face, face6, Pv, blink, s.mo, pal.current, {})

    // Arm A (screen left) reaches; arm B rests, lifts when happy, holds the laptop.
    const a = armA.current, b = armB.current
    if (a) {
      const sw = Math.sin(clock * 0.5 + 1) * 0.03
      const T1 = T.a.copy(REST).add(T.c.set(sw, 0, 0))
      const g = (x: number, y: number, z: number, w: number) => w > 0.001 && T1.lerp(T.b.set(x, y, z), Math.min(w, 1))
      g(-0.2, 1.78, 0.46, chin)
      g(-0.85 + Math.sin(clock * 5.2) * 0.14, 2.35, 0.2, wv)
      g(-0.95, 1.75, 0.72, pt)
      g(PRESS.x, PRESS.y, PRESS.z, d.headphones === 'head' ? ear : 0)
      g(CUP_EAR.x - 0.03, CUP_EAR.y - 0.1, CUP_EAR.z + 0.04, d.headphones === 'neck' ? ear : 0)
      g(-0.62, 1.55, 0.3, 0.35 * lift)
      g(HOLD_A.x, HOLD_A.y, HOLD_A.z, lap)
      reach(a, handA.current, SHOULDER, T1)
    }
    if (b) {
      const R = T.a.set(AR.x + 0.12, AR.y - AR.len, 0.14 + Math.sin(clock * 0.5) * 0.03).lerp(T.b.set(0.7, 1.55, 0.35), lift * 0.6)
      if (d.laptop) R.lerp(T.b.set(0.6, 0.86, 0.2), 1 - lap)
      R.lerp(T.b.set(HOLD_B.x, HOLD_B.y, HOLD_B.z), lap)
      reach(b, handB.current, SHOULDER_B, R)
    }
    // Neck variant: one cup rides to the ear with the hand.
    const cp = cup.current
    if (cp) {
      lerp3(T.a, CUP_REST, CUP_EAR, ear)
      cp.position.copy(T.a)
      cp.rotation.set(0, 0.9 * (1 - ear), 0)
    }
    // Laptop: closed against the side, opens in front of her.
    const lg = lapG.current, ld = lidG.current
    if (lg && ld) {
      lg.position.set(lerp(0.64, 0, lap), lerp(1.0, 0.92, lap), lerp(-0.02, 0.8, lap))
      lg.rotation.set(0, lerp(0.15, 0, lap), (1 - lap) * Math.PI * 0.5)
      lg.scale.setScalar(lerp(0.62, 0.85, lap))
      ld.rotation.x = lerp(Math.PI * 0.5, -0.3, Math.min(1, lap * 1.25))
      const su = uni(kit.screen)
      const hex = screenHex6(L.ctx, pal.current.accent)
      su.uColor!.value.set(hex)
      su.uShade!.value.set(hex)
      su.uGlow!.value = 0.35 + 0.15 * Math.sin(clock * 2.2) + s.mo * 0.2
    }
    if (tail.current) tail.current.rotation.y = Math.sin(clock * (fid === 'tail' ? 9 : 1.2)) * (fid === 'tail' ? 0.5 * fk : 0.1)

    const pulse = 0.5 + 0.5 * Math.sin(clock * 1.6)
    const pg = 0.35 + P.glow * 0.55 + pulse * 0.2
    uni(kit.mats.light).uGlow!.value = pg
    uni(kit.mats.halo).uGlow!.value = 0.4 + pg * 0.5
    if (pearl.current) pearl.current.scale.setScalar(1 + pulse * 0.06 + s.mo * 0.12)
    if (halo.current) halo.current.scale.setScalar(1 + pulse * 0.18 + s.mo * 0.4)
    const fl = lensFlash6(em, clock)
    uni(kit.mats.glint).uGlow!.value = 0.15 + fl * 0.85
    glints.current.forEach((gm) => gm?.scale.set(1 + fl * 0.8, 1 + fl * 1.2, 1))

    const k = 1 - Math.min(Math.max(P.lift * 1.6, 0) * 0.5, 0.3)
    shadowA.current?.scale.set(0.95 * k, 0.8 * k, 1)
    shadowB.current?.scale.set(1.6 * k, 1.3 * k, 1)

    if (!s.ready) {
      s.ready = true
      onReady?.()
    }
  })

  const { mats, geos } = kit
  const sphere = geos.sphere
  const cheek = [-1, 1].map((sx) => {
    const p = new Vector3(sx * 0.3, -0.1, 0).setZ(Math.sqrt(0.25 - 0.09 - 0.01)).multiplyScalar(1.012)
    return { sx, p, yaw: Math.atan2(p.x, p.z), pitch: -Math.asin(p.y / p.length()) }
  })
  return (
    <group>
      <mesh ref={shadowB} material={kit.shadow2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -0.1]}><circleGeometry args={[1, 40]} /></mesh>
      <mesh ref={shadowA} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}><circleGeometry args={[1, 40]} /></mesh>
      <group ref={turn}>
        <group ref={lean}>
          <group ref={sq}>
            {/* shell: a thin plate hugging the back, lime seams, the lime pearl on its upper edge */}
            <group position={[0, SH.y, SH.z]} rotation={[SH.tilt, 0, 0]}>
              <mesh geometry={geos.shell} material={kit.shell} scale={[SH.rx, SH.ry, SH.rz]} />
              <group position={[-SH.rx * 0.72, SH.ry * 0.62, -SH.rz * 0.5]}>
                <mesh ref={halo} material={mats.halo}><sphereGeometry args={[rig6.pearl.r * 1.6, 20, 14]} /></mesh>
                <mesh ref={pearl} material={mats.light}><sphereGeometry args={[rig6.pearl.r, 24, 16]} /></mesh>
              </group>
            </group>

            {/* body: one colour, soft shading, no belly plate; legs and tail grow out of it */}
            <mesh material={mats.lime} geometry={geos.body} position={[0, B.y, 0]} scale={[B.rx, B.ry, B.rz]} />
            <group ref={tail} position={[0, rig6.tail.y, rig6.tail.z]}>
              <mesh material={mats.lime} rotation={[-Math.PI / 2 - 0.4, 0, 0]} position={[0, 0, -0.14]}><coneGeometry args={[0.13, 0.36, 18]} /></mesh>
              <mesh material={mats.lime} geometry={sphere} position={[0, -0.1, -0.3]} scale={0.045} />
            </group>
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * LG.x, LG.y, 0.02]}>
                <mesh material={mats.lime} geometry={geos.leg} />
                <mesh material={mats.lime} geometry={sphere} position={[0, -0.56, 0.1]} scale={[0.24, 0.13, 0.32]} />
                {[-1, 0, 1].map((c) => (
                  <mesh key={c} material={mats.cream} position={[c * 0.095, -0.6, 0.39 + (c === 0 ? 0.02 : 0)]} rotation={[Math.PI / 2, 0, -c * 0.22]}><coneGeometry args={[rig6.claw.r, rig6.claw.len, 10]} /></mesh>
                ))}
              </group>
            ))}

            {/* neck blend, then the head */}
            <mesh material={mats.lime} geometry={sphere} position={[0, 1.68, 0.03]} scale={[0.23, 0.16, 0.22]} />

            {/* arms: one tapered volume from the shoulder to the hand; three claws on each hand */}
            {[-1, 1].map((sx) => (
              <group key={sx} ref={sx < 0 ? armA : armB} position={[sx * AR.x, AR.y, 0.05]}>
                <mesh material={mats.lime} geometry={geos.arm} />
                <group ref={sx < 0 ? handA : handB} position={[0, -0.62, 0]}>
                  {[-1, 0, 1].map((c) => (
                    <mesh key={c} material={mats.cream} position={[c * 0.07, -0.1, 0.03 + (c === 0 ? 0.03 : 0)]} rotation={[Math.PI, 0, c * 0.28]}><coneGeometry args={[rig6.claw.r, rig6.claw.len, 10]} /></mesh>
                  ))}
                </group>
              </group>
            ))}

            {/* headphones round the neck (W): the band on the shoulders, two cups on the chest */}
            {d.headphones === 'neck' ? (
              <group>
                <mesh material={mats.graphite} position={[0, 1.56, -0.01]} rotation={[Math.PI / 2, 0, 0]} scale={[0.38, 0.33, 1]}><torusGeometry args={[1, 0.11, 10, 44]} /></mesh>
                {[-1, 1].map((sx) => (
                  <group key={sx} ref={sx < 0 ? cup : undefined} position={[sx * -CUP_REST.x, CUP_REST.y, CUP_REST.z]} rotation={[0, sx > 0 ? -0.9 : 0.9, 0]}>
                    <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={cupGeo} /></mesh>
                    <mesh material={kit.pad} rotation={[0, 0, Math.PI / 2]} position={[sx * -0.06, 0, 0]}><torusGeometry args={[0.1, 0.035, 10, 24]} /></mesh>
                    <mesh material={mats.light} rotation={[0, 0, Math.PI / 2]} position={[sx * 0.065, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 0.02, 20]} /></mesh>
                  </group>
                ))}
              </group>
            ) : null}

            {/* laptop: closed against her side, opened in front on thinking and talking */}
            {d.laptop ? (
              <group ref={lapG}>
                <mesh material={kit.pad}><boxGeometry args={[0.6, 0.035, 0.42]} /></mesh>
                <mesh material={mats.graphite} position={[0, 0.02, 0.04]}><boxGeometry args={[0.5, 0.004, 0.22]} /></mesh>
                <group ref={lidG} position={[0, 0.0175, -0.21]}>
                  <mesh material={kit.pad} position={[0, 0.2, 0]}><boxGeometry args={[0.6, 0.4, 0.03]} /></mesh>
                  <mesh material={kit.screen} position={[0, 0.2, 0.0165]}><planeGeometry args={[0.52, 0.32]} /></mesh>
                  {[0.07, 0, -0.07].map((y, i) => <mesh key={y} material={mats.graphite} position={[-0.12 + i * 0.03, 0.2 + y, 0.0175]}><planeGeometry args={[0.2 - i * 0.04, 0.022]} /></mesh>)}
                  <mesh material={mats.light} position={[0, 0.2, -0.0165]} rotation={[0, Math.PI, 0]}><circleGeometry args={[0.04, 20]} /></mesh>
                </group>
              </group>
            ) : null}

            {/* head: soft sphere, the face glyph (eyes with two highlights, brows, smile), blush, accessories */}
            <group ref={head}>
              <group scale={H.r / 0.5}>
                <mesh material={mats.lime} geometry={sphere} scale={0.5} />
                <mesh geometry={geos.faceCap} material={kit.face} renderOrder={2} />
                {cheek.map((c) => (
                  <mesh key={c.sx} material={kit.blush} position={c.p} rotation={[c.pitch, c.yaw, 0, 'YXZ']} renderOrder={1}><planeGeometry args={[0.24, 0.16]} /></mesh>
                ))}
                {d.headphones === 'head' ? (
                  <group position={[0, -0.01, -0.02]}>
                    <mesh material={mats.graphite} scale={[1, 1, 1.9]}><torusGeometry args={[0.56, 0.03, 10, 44, Math.PI]} /></mesh>
                    {[-1, 1].map((sx) => (
                      <group key={sx} position={[sx * 0.56, -0.02, 0]}>
                        <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.17, 0.17, 0.13, 28]} /></mesh>
                        <mesh material={kit.pad} rotation={[0, 0, Math.PI / 2]} position={[sx * -0.075, 0, 0]}><torusGeometry args={[0.13, 0.05, 12, 28]} /></mesh>
                        <mesh material={mats.light} rotation={[0, 0, Math.PI / 2]} position={[sx * 0.07, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.02, 24]} /></mesh>
                      </group>
                    ))}
                  </group>
                ) : null}
                {d.glasses ? (
                  <group position={[0, 0.04, 0.5]}>
                    {[-1, 1].map((sx, i) => (
                      <group key={sx} position={[sx * 0.19, 0, 0]}>
                        <mesh material={mats.graphite}><torusGeometry args={[0.135, 0.014, 10, 36]} /></mesh>
                        <mesh material={mats.glass} position={[0, 0, -0.004]}><circleGeometry args={[0.132, 28]} /></mesh>
                        <mesh ref={(el) => void (glints.current[i] = el)} material={mats.glint} position={[-0.05, 0.055, 0.004]} rotation={[0, 0, 0.7]}><capsuleGeometry args={[0.009, 0.045, 4, 8]} /></mesh>
                        <mesh material={mats.graphite} position={[sx * 0.12, 0, -0.16]} rotation={[0, Math.PI / 2 + sx * 0.12, 0]}><cylinderGeometry args={[0.009, 0.009, 0.34, 6]} /></mesh>
                      </group>
                    ))}
                    <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.011, 0.07, 4, 8]} /></mesh>
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

export default function FiraScene6({ variant, emotion, lookAt, mouth, theme, active, clock, spin, ctx, onReady }: Scene6Props) {
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
