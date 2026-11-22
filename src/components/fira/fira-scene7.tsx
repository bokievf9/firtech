'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3, type BufferGeometry, type Group, type Mesh } from 'three'
import { readPalette, palettes } from '@/lib/fira/palette'
import { clampLook, stepSpring, type Emotion } from '@/lib/fira/pose'
import { blink3, blinkLen3, channels3, springFor, tempo3, type T3 } from '@/lib/fira/pose3'
import { nextFidget } from '@/lib/fira/turtle'
import { BASE_YAW6, bodyYaw6, feel6, lensFlash6 } from '@/lib/fira/turtle6'
import { ACC_MORPH7, FINGERS7, TOES7, accFlags7, accOf7, noteState7, notesOnFor7, rig7, scutes7, targets7, type AccSet7, type Turtle7 } from '@/lib/fira/turtle7'
import { driveGlyph, type FaceSpec3 } from './fira-kit3'
import { driveEyes7, EYE_PARTS, face7, faceG7, makeKit7, paint7, type Kit7 } from './fira-kit7'
import { uni } from './materials'

// Round seven: one standing rig for A B C D traced from the owner's reference art. Egg body with a cream plastron,
// teal shell showing on both sides, short stubby arms flowing from the shoulders, round feet with three toes,
// a wide flattened head with the half-lidded face, a thin outline on every shape. Motion of round six is kept:
// faces the viewer, the whole body turns toward the pointer, breathing, blinks, look-around, fidgets.
export type Scene7Props = {
  variant: Turtle7
  /** Accessories now worn (glasses, headphones, laptop); they change with the page context. Default: the variant's own. */
  acc?: AccSet7
  emotion: Emotion
  lookAt?: boolean
  mouth?: number
  theme?: 'light' | 'dark'
  clock?: number
  spin?: number
  active: boolean
  onReady?: () => void
}
type Live = Omit<Scene7Props, 'variant' | 'theme' | 'active' | 'onReady'>
const sub0 = (L: Live) => (L.clock !== undefined ? 8 : 1)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const faceM: FaceSpec3 = { sep: 0.235, y: -0.05, w: 0.122, h: 0.132, mouthY: -0.265, mouthW: 0.085, look: [0.07, 0.05] }
const { head: H, body: B, shell: SH, foot: F, arm: AR, plastron: PL } = rig7
const SH_A = new Vector3(-AR.x, AR.y, 0.2), SH_B = new Vector3(AR.x, AR.y, 0.2)
const REST_A = new Vector3(-0.3, 0.97, 0.66), REST_B = new Vector3(0.3, 0.97, 0.66)
const HOLD_A = new Vector3(-0.42, 1.04, 0.86), HOLD_B = new Vector3(0.42, 1.04, 0.86)

// One shape and its toon outline (the same geometry, back faces, pushed out in view space).
function Part({ g, m, ol, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] }: { g: BufferGeometry; m: Kit7['mats']['lime']; ol: Kit7['ol'] | null; p?: [number, number, number]; s?: [number, number, number]; r?: [number, number, number] }) {
  return (
    <group position={p} scale={s} rotation={r}>
      <mesh geometry={g} material={m} />
      {ol ? <mesh geometry={g} material={ol} /> : null}
    </group>
  )
}

function Rig({ acc0, live, theme, onReady }: { acc0: AccSet7; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit = useMemo(() => makeKit7(), [])
  useEffect(() => () => kit.dispose(), [kit])
  const f0 = accFlags7(acc0)
  const pal = useRef({ light: palettes.light.accent, accent: palettes.light.accent, dark: false })
  useEffect(() => {
    const apply = () => {
      const p = theme ? palettes[theme] : readPalette()
      paint7(kit, p)
      pal.current = { light: p.accent, accent: p.accent, dark: p.dark }
    }
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const S = useRef({
    sp: Object.fromEntries(channels3.map((c) => [c, { x: targets7.idle[c], v: 0 }])) as Record<keyof T3, { x: number; v: number }>,
    P: { ...targets7.idle }, wave: { x: 0, v: 0 }, point: { x: 0, v: 0 }, think: { x: 0, v: 0 }, skep: { x: 0, v: 0 }, lift: { x: 0, v: 0 },
    t: 0, ph: 0, next: 2.4, bt: -1, dbl: false, prev: 'idle' as Emotion, px: 0, py: 0, mo: 0, by: BASE_YAW6, lastMove: -99,
    acg: { x: f0.glasses ? 1 : 0, v: 0 }, ach: { x: f0.headphones ? 1 : 0, v: 0 }, acl: { x: f0.laptop ? 1 : 0, v: 0 }, hp: f0.headphones,
    fid: { at: 6, kind: 'look' as string, t: -1, dir: 1 }, sv: 0, sy: 0, ready: false,
  })
  const turn = useRef<Group>(null), lean = useRef<Group>(null), sq = useRef<Group>(null), head = useRef<Group>(null), tail = useRef<Group>(null)
  const armA = useRef<Group>(null), armB = useRef<Group>(null), handA = useRef<Group>(null), handB = useRef<Group>(null)
  const glints = useRef<(Mesh | null)[]>([null, null]), rings = useRef<(Mesh | null)[]>([null, null]), noteG = useRef<(Group | null)[]>([null, null, null])
  const lapG = useRef<Group>(null), accG = useRef<Group>(null), accH = useRef<Group>(null), accL = useRef<Group>(null)
  const shadowA = useRef<Mesh>(null), shadowB = useRef<Mesh>(null)
  const tmp = useRef({ down: new Vector3(0, -1, 0), v: new Vector3(), a: new Vector3(), b: new Vector3() })

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

  // Aims an arm (hanging down from its shoulder) at a point in body space, stretching it a little to reach.
  const reach = (arm: Group, hand: Group | null, from: Vector3, to: Vector3) => {
    const T = tmp.current
    T.v.copy(to).sub(from)
    const len = T.v.length()
    arm.quaternion.setFromUnitVectors(T.down, T.v.normalize())
    const ext = Math.min(1.6, Math.max(0.6, len / AR.len))
    arm.scale.y = ext
    hand?.scale.set(1, 1 / ext, 1)
  }

  useFrame((state, dtRaw) => {
    const s = S.current, L = live.current, T = tmp.current
    const dt = Math.min(dtRaw, 0.05)
    const cam = state.camera
    cam.position.z += (7.0 - cam.position.z) * (1 - Math.exp(-dt * 5))
    cam.position.y = 1.5 + 0.05 * (cam.position.z - 4)
    cam.lookAt(0, 1.4, 0)
    s.t += dt
    const fixed = L.clock !== undefined
    const clock = L.clock ?? s.t
    const em = L.emotion
    const accW = accFlags7(L.acc ?? acc0)
    let wg = 0, wh = 0, wl = 0
    for (let i = 0; i < sub0(L); i++) {
      wg = stepSpring(s.acg, accW.glasses ? 1 : 0, dt, ACC_MORPH7.k, ACC_MORPH7.z)
      wh = stepSpring(s.ach, accW.headphones ? 1 : 0, dt, ACC_MORPH7.k, ACC_MORPH7.z)
      wl = stepSpring(s.acl, accW.laptop ? 1 : 0, dt, ACC_MORPH7.k, ACC_MORPH7.z)
    }
    s.hp = wh > 0.5
    const lapOn = wl > 0.5
    const tg = targets7[em]
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
    let wv = 0, pt = 0, th = 0, sk = 0, lf = 0
    for (let i = 0; i < sub; i++) {
      wv = stepSpring(s.wave, P.wave > 0.5 ? 1 : 0, dt, 60, 0.8)
      pt = stepSpring(s.point, P.arm > 0.5 ? 1 : 0, dt, 60, 0.8)
      th = stepSpring(s.think, em === 'thinking' && !lapOn ? 1 : 0, dt, 60, 0.8)
      sk = stepSpring(s.skep, em === 'sorry' && !lapOn ? 1 : 0, dt, 60, 0.8)
      lf = stepSpring(s.lift, em === 'happy' || em === 'listening' ? 0.5 : em === 'surprised' ? 1 : 0, dt, 50, 0.7)
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

    const Pv = { ...P, smile: P.smile + 0.1, lookX: P.lookX + s.px * 0.5 - lag * 0.25, lookY: P.lookY + s.py * 0.6 }
    driveGlyph(kit.face, faceM, Pv, blink, s.mo, pal.current, {})
    driveEyes7(kit.eyes, accW.glasses ? faceG7 : face7, Pv, blink, em === 'sleep', Pv.lookX, Pv.lookY)

    // Arms hang down-forward; B lifts beside the head to think or wave, A points, crosses when skeptical, both hold the laptop.
    const a = armA.current, b = armB.current
    const swA = Math.sin(clock * 0.5 + 1) * 0.02, swB = Math.sin(clock * 0.5) * 0.02
    if (a) {
      const R = T.a.copy(REST_A).add(T.b.set(swA, 0, 0))
      const g = (x: number, y: number, z: number, w: number) => w > 0.001 && R.lerp(T.b.set(x, y, z), Math.min(w, 1))
      g(-0.95, 1.6, 0.8, pt)
      g(0.12, 1.0, 0.7, sk)
      g(-0.6, 1.5, 0.55, lf)
      if (wl > 0.01) R.lerp(HOLD_A, Math.min(wl, 1))
      reach(a, handA.current, SH_A, R)
    }
    if (b) {
      const R = T.a.copy(REST_B).add(T.b.set(swB, 0, 0))
      const g = (x: number, y: number, z: number, w: number) => w > 0.001 && R.lerp(T.b.set(x, y, z), Math.min(w, 1))
      g(0.86, 1.82, 0.25, th)
      g(0.9 + Math.sin(clock * 5.2) * 0.12, 1.95, 0.2, wv)
      g(0.6, 1.5, 0.55, lf)
      if (wl > 0.01) R.lerp(HOLD_B, Math.min(wl, 1))
      reach(b, handB.current, SH_B, R)
    }
    // Accessories are separate objects: they slide and scale in on a context change (the snappy spring, under 400 ms).
    const gg = accG.current, hh = accH.current, ll = accL.current
    if (gg) { gg.visible = wg > 0.01; gg.position.set(0, (1 - wg) * 0.32, (1 - wg) * 0.3); gg.scale.setScalar(0.6 + 0.4 * wg) }
    if (hh) { hh.visible = wh > 0.01; hh.position.set(0, (1 - wh) * 0.45, 0); hh.scale.setScalar(0.65 + 0.35 * wh) }
    if (ll) { ll.visible = wl > 0.01; ll.position.set(0, -(1 - wl) * 0.8, (1 - wl) * 0.3); ll.scale.setScalar(0.6 + 0.4 * wl) }
    if (lapG.current) lapG.current.rotation.x = -0.12 + (em === 'thinking' ? 0.08 : 0) + breath * 0.5
    if (tail.current) tail.current.rotation.y = Math.sin(clock * (fid === 'tail' ? 9 : 1.2)) * (fid === 'tail' ? 0.5 * fk : 0.1)

    const pulse = 0.5 + 0.5 * Math.sin(clock * 1.6)
    const pg = 0.3 + P.glow * 0.2 + pulse * 0.12
    uni(kit.mats.light).uGlow!.value = pg
    uni(kit.mats.halo).uGlow!.value = 0.4 + pg * 0.5
    rings.current.forEach((r) => r?.scale.setScalar(1 + pulse * 0.08))
    const fl = lensFlash6(em, clock)
    uni(kit.mats.glint).uGlow!.value = 0.15 + fl * 0.85
    glints.current.forEach((gm) => gm?.scale.set(1 + fl * 0.8, 1 + fl * 1.2, 1))
    // Notes float up from the headphones while she listens (dark theme).
    const on = notesOnFor7(s.hp, em, pal.current.dark)
    noteG.current.forEach((g, i) => {
      if (!g) return
      const n = noteState7(i, clock)
      const k = on ? n.a : 0
      g.visible = k > 0.02
      g.position.set(-0.95 + n.x * 0.5 + (i % 2) * 1.9, 2.0 + n.y * 0.8, 0.2)
      g.scale.setScalar(0.9 * k)
      g.rotation.z = Math.sin(clock * 2 + i) * 0.2
    })

    const k = 1 - Math.min(Math.max(P.lift * 1.6, 0) * 0.5, 0.3)
    shadowA.current?.scale.set(0.95 * k, 0.8 * k, 1)
    shadowB.current?.scale.set(1.6 * k, 1.3 * k, 1)

    if (!s.ready) {
      s.ready = true
      onReady?.()
    }
  })

  const { mats, geos } = kit
  const sp = geos.sphere
  const ol = kit.ol
  const cheek = [-1, 1].map((sx) => {
    const p = new Vector3(sx * 0.34, -0.2, 0).setZ(Math.sqrt(0.25 - 0.1156 - 0.04)).multiplyScalar(1.012)
    return { sx, p, yaw: Math.atan2(p.x, p.z), pitch: -Math.asin(p.y / p.length()) }
  })
  return (
    <group>
      {/* dark theme: a soft lime glow behind the figure (as in the video frames) */}
      <mesh material={kit.glow} position={[0, 1.4, -1.4]} scale={[3.4, 3.8, 1]} renderOrder={-1}><planeGeometry args={[1, 1]} /></mesh>
      <mesh ref={shadowB} material={kit.shadow2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -0.1]}><circleGeometry args={[1, 40]} /></mesh>
      <mesh ref={shadowA} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}><circleGeometry args={[1, 40]} /></mesh>
      <group ref={turn}>
        <group ref={lean}>
          <group ref={sq}>
            {/* shell: dark teal plate pressed to the back, wider than the body so it shows on both sides, with light hexagonal scutes */}
            <group position={[0, SH.y, SH.z]} rotation={[SH.tilt, 0, 0]}>
              <mesh geometry={geos.shell} material={kit.shell} scale={[SH.rx, SH.ry, SH.rz]} />
              <mesh geometry={geos.shell} material={ol} scale={[SH.rx, SH.ry, SH.rz]} />
            </group>
            {scutes7.flatMap((c) => [-1, 1].map((sx) => (
              <mesh key={`${c.y}${sx}`} geometry={geos.hex} material={kit.scute} position={[sx * c.x, c.y, SH.z + 0.04 + 0.07 * Math.sqrt(Math.max(0, 1 - (c.x / SH.rx) ** 2 - ((c.y - SH.y) / SH.ry) ** 2))]} rotation={[0, sx * 0.55, Math.PI / 6]} scale={[0.1, 0.1, 1]} />
            )))}
            {/* tail: a tiny cone at the lower right */}
            <group ref={tail} position={[AR.x + 0.04, rig7.tail.y, rig7.tail.z]}>
              <Part g={geos.shell} m={mats.lime} ol={ol} p={[0.12, -0.03, -0.1]} s={[0.17, 0.07, 0.07]} r={[0, 0.5, -0.35]} />
            </group>
            {/* body: egg, cream plastron with 2 x 3 segments on the front */}
            <Part g={geos.body} m={mats.lime} ol={ol} p={[0, B.y, 0]} s={[B.rx / 1.1, B.ry, B.rz]} />
            <mesh geometry={sp} material={kit.plastron} position={[0, PL.y, PL.z]} scale={[PL.rx, PL.ry, PL.rz]} />
            {/* feet: a short thick leg with three pale nails */}
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * F.x, F.y, 0.1]}>
                <Part g={sp} m={mats.lime} ol={ol} s={[F.rx, F.ry, F.rz]} />
                {Array.from({ length: TOES7 }, (_, i) => i - 1).map((c) => <Part key={c} g={sp} m={mats.cream} ol={null} p={[c * 0.11 + sx * 0.02, -0.05, 0.3 - Math.abs(c) * 0.04]} s={[0.05, 0.036, 0.034]} />)}
              </group>
            ))}
            {/* arms: one stubby tapered volume from the shoulder, a paw of three short fingers with pale nails */}
            {[-1, 1].map((sx) => (
              <group key={sx} ref={sx < 0 ? armA : armB} position={[sx * AR.x, AR.y, 0.2]}>
                <mesh material={mats.lime} geometry={geos.arm} />
                <mesh material={ol} geometry={geos.arm} />
                <group ref={sx < 0 ? handA : handB} position={[0, -AR.len, 0]}>
                  {Array.from({ length: FINGERS7 }, (_, i) => i - 1).map((c) => (
                    <group key={c} position={[c * 0.065, -0.085 - (c === 0 ? 0.015 : 0), 0.06]}>
                      <Part g={sp} m={mats.lime} ol={ol} s={[0.05, 0.062, 0.05]} />
                      <Part g={sp} m={mats.cream} ol={null} p={[0, -0.04, 0.03]} s={[0.03, 0.02, 0.022]} />
                    </group>
                  ))}
                </group>
              </group>
            ))}

            {/* laptop (a separate object, comes with the context): dark lid toward the viewer with a lime hexagon logo */}
            <group ref={accL} visible={f0.laptop}>
              <group ref={lapG} position={[0, 0.66, 0.74]}>
                <mesh material={kit.pad}><boxGeometry args={[1.12, 0.7, 0.05]} /></mesh>
                <mesh material={ol} scale={1.05}><boxGeometry args={[1.12, 0.7, 0.05]} /></mesh>
                <mesh material={mats.graphite} position={[0, -0.36, -0.02]}><boxGeometry args={[1.2, 0.045, 0.14]} /></mesh>
                <mesh ref={(el) => void (rings.current[0] = el)} material={mats.light} position={[0, 0, 0.03]} rotation={[0, 0, Math.PI / 6]}><torusGeometry args={[0.1, 0.02, 6, 6]} /></mesh>
              </group>
            </group>

            {/* head: wide dome, face parts as meshes on the surface (eyes with lids, brows, nose dots, gloss), mouth by shader, blush */}
            <group ref={head}>
              <group scale={[H.rx / 0.5, H.ry / 0.5, H.rz / 0.5]}>
                <mesh material={mats.lime} geometry={sp} scale={0.5} />
                <mesh material={ol} geometry={sp} scale={0.5} />
                <mesh geometry={geos.faceCap} material={kit.face} renderOrder={2} />
                {kit.eyes.sides.flatMap((m, i) => EYE_PARTS.map((n, k) => <mesh key={`${i}${n}`} geometry={kit.eyes.geoOf[n]} material={m[n]} frustumCulled={false} renderOrder={3 + k} />))}
                {(['noseL', 'noseR', 'gloss', 'dotA', 'dotB'] as const).map((n) => <mesh key={n} geometry={kit.eyes.circle} material={kit.eyes.extra[n]} frustumCulled={false} renderOrder={3} />)}
                {cheek.map((c) => (
                  <mesh key={c.sx} material={kit.blush} position={c.p} rotation={[c.pitch, c.yaw, 0, 'YXZ']} renderOrder={1}><planeGeometry args={[0.26, 0.15]} /></mesh>
                ))}
              </group>
              {/* headphones: a separate object */}
              <group ref={accH} visible={f0.headphones}>
                <group position={[0, -0.04, -0.02]}>
                  <mesh material={mats.graphite} scale={[0.72, 0.82, 1.4]}><torusGeometry args={[1, 0.058, 10, 56, Math.PI]} /></mesh>
                  {[-1, 1].map((sx) => (
                    <group key={sx} position={[sx * 0.73, 0.02, 0.02]} rotation={[0, -sx * 0.8, 0]}>
                      <mesh material={mats.graphite} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.17, 0.17, 0.16, 32]} /></mesh>
                      <mesh material={ol} rotation={[0, 0, Math.PI / 2]} scale={1.06}><cylinderGeometry args={[0.17, 0.17, 0.16, 32]} /></mesh>
                      <mesh ref={(el) => void (rings.current[sx < 0 ? 0 : 1] = el)} material={mats.light} position={[sx * 0.085, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.085, 0.024, 10, 32]} /></mesh>
                      <mesh material={mats.halo} position={[sx * 0.09, 0, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.15, 24]} /></mesh>
                    </group>
                  ))}
                </group>
              </group>
              {/* glasses: a separate object resting on the face, thin round black rims, temples back to the ears */}
              <group ref={accG} visible={f0.glasses}>
                <group position={[0, -0.05, 0.5]}>
                  {[-1, 1].map((sx, i) => (
                    <group key={sx} position={[sx * 0.31, 0, -sx * sx * 0.02]} rotation={[0, sx * 0.34, 0]}>
                      <mesh material={mats.graphite}><torusGeometry args={[0.235, 0.014, 10, 48]} /></mesh>
                      <mesh material={mats.glass} position={[0, 0, -0.004]}><circleGeometry args={[0.232, 32]} /></mesh>
                      <mesh ref={(el) => void (glints.current[i] = el)} material={mats.glint} position={[-0.07, 0.08, 0.006]} rotation={[0, 0, 0.7]}><capsuleGeometry args={[0.01, 0.06, 4, 8]} /></mesh>
                      <mesh material={mats.graphite} position={[sx * 0.25, 0.01, -0.2]} rotation={[0, Math.PI / 2 - sx * 0.2, 0]}><cylinderGeometry args={[0.01, 0.01, 0.46, 6]} /></mesh>
                    </group>
                  ))}
                  <mesh material={mats.graphite} position={[0, 0.02, 0.01]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.011, 0.08, 4, 8]} /></mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
        {/* floating notes (headphones, dark theme) */}
        {true
          ? [0, 1, 2].map((i) => (
              <group key={i} ref={(el) => void (noteG.current[i] = el)} visible={false}>
                <mesh material={mats.light} scale={[0.065, 0.045, 0.03]} geometry={sp} />
                <mesh material={mats.light} position={[0.055, 0.1, 0]}><boxGeometry args={[0.018, 0.2, 0.018]} /></mesh>
                <mesh material={mats.light} position={[0.095, 0.18, 0]} rotation={[0, 0, -0.6]}><boxGeometry args={[0.07, 0.022, 0.018]} /></mesh>
              </group>
            ))
          : null}
      </group>
    </group>
  )
}

export default function FiraScene7({ variant, acc, emotion, lookAt, mouth, theme, active, clock, spin, onReady }: Scene7Props) {
  const live = useRef<Live>({ emotion, lookAt, mouth, clock, spin, acc })
  useEffect(() => {
    live.current = { emotion, lookAt, mouth, clock, spin, acc }
  })
  return (
    <Canvas
      data-fira-canvas=""
      dpr={[1, 1.5]}
      resize={{ offsetSize: true }}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 2.9, 7.2], fov: 27 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      aria-hidden="true"
    >
      <Rig acc0={acc ?? accOf7(variant)} live={live} theme={theme} onReady={onReady} />
    </Canvas>
  )
}
