'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3, type Group, type Mesh } from 'three'
import { readPalette, palettes } from '@/lib/fira/palette'
import { clampLook, stepSpring, type Emotion } from '@/lib/fira/pose'
import { blink3, blinkLen3, channels3, springFor, targets3, tempo3, type T3 } from '@/lib/fira/pose3'
import { EYE_HALF4, eventLevel, eventSpec, accessoryMeta, extras4, nextFidget, turtleFeel, type Accessory, type EventKind, type Fidget, type LightMode, type Turtle } from '@/lib/fira/turtle'
import { driveGlyph, type FaceSpec3 } from './fira-kit3'
import { colors4, makeKit4, onShell, paint4 } from './fira-kit4'
import { accSlots, Glasses } from './fira-acc4'
import { uni } from './materials'

// Round four: one frame loop for the four turtles. Same spring idea as round three (pose3 channels),
// plus the neck (retract into the shell when sorry), the front paws (point, wave, scratch, hold an
// accessory), the shell-light layer, micro-fidgets and a head that follows pointer and scroll.
export type Scene4Props = {
  variant: Turtle
  emotion: Emotion
  acc?: Accessory
  lookAt?: boolean
  mouth?: number
  theme?: 'light' | 'dark'
  clock?: number
  spin?: number
  active: boolean
  event?: { kind: EventKind; id: number } | null
  lights?: LightMode
  /** Sound cues are a stub for now: only 'off' exists. */
  sfx?: 'off'
  onReady?: () => void
}
type Live = Omit<Scene4Props, 'variant' | 'theme' | 'active' | 'onReady' | 'sfx'>
const BASE_YAW = 0.55, GROUND = 0, S0 = 1
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const face4: FaceSpec3 = { sep: 0.17, y: 0.07, w: EYE_HALF4, h: EYE_HALF4, mouthY: -0.15, mouthW: 0.085, brow: [0.085, 0.032], look: [0.07, 0.05] }
const eyesOnly: FaceSpec3 = { ...face4, mouthY: undefined, mouthW: undefined, brow: undefined }
const mouthOnly: FaceSpec3 = { ...face4 }
const lampAt = (v: Turtle, i: number, n: number, kit: ReturnType<typeof makeKit4>): [number, number, number] => {
  const s = kit.spec.shell
  if (v === 'p') return [(i - (n - 1) / 2) * 0.17, 1.3, -1.05]
  const a = Math.PI * (0.32 + (1.36 * i) / Math.max(1, n - 1))
  const x = s.sx * 0.86 * Math.sin(a), z = s.z + s.sz * 0.86 * Math.cos(a)
  const p = onShell(s, x, z)
  return [p.pos[0], p.pos[1], p.pos[2]]
}

function Rig({ variant, acc: accId, live, theme, onReady }: { variant: Turtle; acc?: Accessory; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit = useMemo(() => makeKit4(variant), [variant])
  useEffect(() => () => kit.dispose(), [kit])
  const wide = Boolean(accId && accSlots(accId, kit).world)
  useEffect(() => {
    const apply = () => {
      const p = theme ? palettes[theme] : readPalette()
      paint4(kit, p)
      pal.current = { light: p.accent, accent: p.accent }
    }
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const pal = useRef({ light: palettes.light.accent, accent: palettes.light.accent })
  const feel = turtleFeel[variant]
  const spec = kit.spec
  const S = useRef({
    sp: Object.fromEntries(channels3.map((c) => [c, { x: targets3.idle[c], v: 0 }])) as Record<keyof T3, { x: number; v: number }>,
    P: { ...targets3.idle }, ex: { retract: { x: 0, v: 0 }, scratch: { x: 0, v: 0 }, hold: { x: 0, v: 0 }, holdL: { x: 0, v: 0 }, both: { x: 0, v: 0 } },
    t: 0, ph: 0, next: 2.4, bt: -1, dbl: false, prev: 'idle' as Emotion, px: 0, py: 0, mo: 0, ant: { x: 0, v: 0 },
    fid: { at: 6, kind: 'look' as Fidget, t: -1, dir: 1 }, sv: 0, sy: 0, evId: -1, evT: -99, ready: false,
  })
  const turn = useRef<Group>(null), lean = useRef<Group>(null), sq = useRef<Group>(null), head = useRef<Group>(null), ant = useRef<Group>(null), tail = useRef<Group>(null)
  const legs = useRef<(Group | null)[]>([null, null, null, null])
  const grips = useRef<(Group | null)[]>([null, null])
  const aimQ = useRef({ q: new Quaternion(), t: new Quaternion(), down: new Vector3(0, -1, 0), v: new Vector3() })
  const lampRefs = useRef<(Mesh | null)[]>([])
  const steam = useRef<Group>(null), shadowA = useRef<Mesh>(null), shadowB = useRef<Mesh>(null)

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

  const slots = useMemo(() => accSlots(accId, kit), [accId, kit])

  useFrame((state, dtRaw) => {
    const s = S.current, L = live.current
    const dt = Math.min(dtRaw, 0.05)
    const cz = wide ? 8.4 : 6.7
    const cam = state.camera
    cam.position.z += (cz - cam.position.z) * (1 - Math.exp(-dt * 5))
    cam.position.y = 0.43 * cam.position.z
    cam.lookAt(0, 0.7, 0)
    s.t += dt
    const fixed = L.clock !== undefined
    const clock = L.clock ?? s.t
    const em = L.emotion
    const tg = targets3[em]
    const P = s.P
    // Stills (fixed clock) settle fast: several spring sub-steps per frame, so a slow software GL still lands on the pose.
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
    const X = extras4[em]
    const holdWho = accId ? accessoryMeta[accId].hold : 'none'
    let retract = 0, scratch = 0, hR = 0, hL = 0, hB = 0
    for (let i = 0; i < sub; i++) {
      retract = stepSpring(s.ex.retract, X.retract, dt, 60, 0.85)
      scratch = stepSpring(s.ex.scratch, X.scratch, dt, 70, 0.8)
      hR = stepSpring(s.ex.hold, holdWho !== 'none' ? 1 : 0, dt, 70, 0.85)
      hL = stepSpring(s.ex.holdL, holdWho === 'both' ? 1 : 0, dt, 70, 0.85)
      hB = stepSpring(s.ex.both, holdWho === 'both' ? 1 : 0, dt, 70, 0.85)
    }
    const hz = tempo3[em] * feel.tempo
    s.ph = fixed ? clock * hz : s.ph + dt * hz
    const breath = Math.sin(s.ph * Math.PI * 2) * P.breath * 1.3

    const wgt = L.lookAt ? P.pointer * feel.gaze : 0
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
        s.dbl = Math.random() < feel.double
      }
      if (s.bt >= 0) {
        s.bt += dt
        if (s.bt > blinkLen3(s.dbl)) {
          s.bt = -1
          s.next = s.t + feel.blink[0] + (feel.blink[1] - feel.blink[0]) * Math.random()
        }
      }
      const f = s.fid
      if (f.t < 0 && s.t >= f.at && (em === 'idle' || em === 'listening')) {
        const nf = nextFidget(variant, Math.random(), Math.random())
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
    const sway = Math.sin(clock * 0.45) * 0.012
    ln.position.y = P.lift * 1.6
    ln.rotation.set(spec.lean + P.lean * 0.35, 0, P.roll * 0.5 + sway + (fid === 'shift' ? fk * 0.05 * s.fid.dir : 0))
    const sy = P.squash * (1 + breath * 0.5)
    q.scale.set(1 / Math.sqrt(Math.max(sy, 0.2)), sy, 1 / Math.sqrt(Math.max(sy, 0.2)))

    // Head: pointer, scroll and fidget on top of the emotion; retracts into the shell when sorry.
    const yaw = -0.5 - P.yaw * 0.8 + P.headRoll * -0.4 + s.px * 0.9 * 1 + (fid === 'look' ? fk * 0.55 * s.fid.dir : 0)
    hd.position.set(0, spec.neckY - retract * 0.12 + breath * 0.3, spec.neckZ - retract * 0.42)
    hd.rotation.set(P.head * 1.1 + P.lean * 0.4 - s.py * 0.4 + s.sy * 0.3 + (em === 'sleep' ? 0.15 : 0) + (fid === 'look' ? fk * -0.1 : 0), yaw, P.headRoll * 0.8 - s.px * 0.08)
    const hs = spec.head * (1 - retract * 0.1)
    hd.scale.setScalar(hs)

    const Pv = { ...P, smile: P.smile + 0.4, lookX: P.lookX + s.px * 0.6 - (yaw + 0.5 + P.yaw * 0.8) * 0.2, lookY: P.lookY + s.py * 0.6 }
    if (variant === 'o' && kit.visor && kit.mouthCap) {
      driveGlyph(kit.visor, eyesOnly, Pv, blink, s.mo, pal.current, {})
      driveGlyph(kit.mouthCap, mouthOnly, Pv, blink, s.mo, pal.current, {})
    } else driveGlyph(kit.face, face4, Pv, blink, s.mo, pal.current, {})

    // Front limbs: -x (the one nearer the camera) is the active paw (point, wave, scratch, hold), -x the other.
    const [fr, fl, br, bl] = legs.current
    const hN = Math.max(hR, hL), gest = 1 - hN
    const wv = P.wave * gest, ar = P.arm * gest, sc = scratch * gest
    if (fr) {
      // Near paw, aimed in the body frame (the camera is toward -x, +z): hold out to the side, wave up,
      // point out and forward, think (paw rises toward the head side).
      const A = aimQ.current
      A.q.identity()
      const to = (x: number, y: number, z: number, w: number) => w > 0.001 && A.q.slerp(A.t.setFromUnitVectors(A.down, A.v.set(x, y, z).normalize()), Math.min(w, 1))
      to(-0.8, 0.6, 0.4, hN)
      to(-0.9, 0.2, 0.5, ar)
      to(-0.5 + Math.sin(clock * 5.2) * 0.3, 0.85, 0.05, wv)
      to(-0.25 + Math.sin(clock * 11) * 0.08, 0.65, 0.75, sc)
      fr.quaternion.copy(A.q)
      const ext = 1 + 0.9 * Math.max(hN, wv, ar, sc)
      fr.scale.y = ext
      const g = grips.current[0]
      if (g) {
        g.quaternion.copy(fr.quaternion).invert()
        g.scale.set(1, 1 / ext, 1)
      }
    }
    if (fl) {
      const A = aimQ.current
      fl.quaternion.identity().slerp(A.t.setFromUnitVectors(A.down, A.v.set(0.5, 0.6, 0.7).normalize()), hL * hB)
      fl.scale.y = 1 + 0.9 * hB
      const g = grips.current[1]
      if (g) {
        g.quaternion.copy(fl.quaternion).invert()
        g.scale.set(1, 1 / fl.scale.y, 1)
      }
    }
    if (br) br.rotation.set(Math.sin(s.ph * 6.28 + 2) * 0.015, 0, 0)
    if (bl) bl.rotation.set((fid === 'tap' ? -Math.abs(Math.sin(fk * Math.PI * 4)) * 0.4 * fk : 0) + Math.sin(s.ph * 6.28 + 3) * 0.015, 0, 0)
    if (tail.current) tail.current.rotation.y = Math.sin(clock * (fid === 'tail' ? 9 : 1.2)) * (fid === 'tail' ? 0.5 * fk : 0.08) + P.wave * Math.sin(clock * 6) * 0.2

    // Antenna lags the body on a soft spring.
    if (ant.current) {
      stepSpring(s.ant, -(P.roll + sway) * 1.6 + P.lean * 0.7 - s.sy * 0.1, dt, 60, 0.35)
      ant.current.rotation.z = s.ant.x
    }

    // Light layer: idle twinkle, a ring on events, waves with the voice.
    if (L.event && L.event.id !== s.evId) {
      s.evId = L.event.id
      s.evT = s.t
    }
    let evAge = L.event ? (fixed ? clock : s.t - s.evT) : -1
    let kind: EventKind = L.event?.kind ?? 'lead'
    if (L.lights === 'event' && (!L.event || evAge > eventSpec[kind].dur)) {
      kind = L.event?.kind ?? 'lead'
      evAge = (fixed ? clock : s.t) % (eventSpec[kind].dur + 1)
    }
    const evLvl = evAge >= 0 ? eventLevel(kind, evAge) : 0
    const talk = L.lights === 'talk' ? 0.8 : clamp01(s.mo * 1.5)
    const su = uni(kit.shell)
    su.uTime!.value = clock
    su.uEvAge!.value = evAge >= 0 && evAge < eventSpec[kind].dur ? evAge : -1
    su.uEvAmt!.value = 1
    su.uTalk!.value = L.lights === 'idle' ? 0 : talk
    su.uIdle!.value = 1 - evLvl * 0.6
    const ec = eventSpec[kind].color
    su.uEvCol!.value.set(ec === 'lime' ? pal.current.accent : colors4[ec])
    const act = 0.15 + talk * 0.7 + (em === 'thinking' ? 0.5 : 0)
    for (const sc of Object.values(kit.scr)) {
      const u = uni(sc)
      u.uTime!.value = clock
      u.uAct!.value = act
      u.uFlash!.value = evLvl
    }
    kit.lamps.forEach((lm, i) => {
      const ev = evAge >= 0 ? eventLevel(kind, evAge - i * 0.07) : 0
      const idle = 0.12 + 0.18 * Math.pow(Math.sin(clock * 0.8 + i * 1.7) * 0.5 + 0.5, 2)
      uni(lm).uGlow!.value = L.lights === 'event' || L.lights === 'talk' ? idle * 0.4 + ev * 0.9 + talk * (0.3 + 0.4 * Math.sin(i * 2 + clock * 14)) : idle + ev * 0.9 + talk * (0.25 + 0.35 * Math.sin(i * 2 + clock * 14))
      lampRefs.current[i]?.scale.setScalar(1 + ev * 0.5)
    })
    uni(kit.mats.light).uGlow!.value = 0.15 + talk * 0.4 + evLvl * 0.8

    const stm = steam.current
    if (stm) stm.children.forEach((c, i) => {
      const ph = (clock * 0.35 + i / 3) % 1
      c.position.set(Math.sin(ph * 6 + i) * 0.04, 0.38 + ph * 0.4, 0)
      c.scale.setScalar(0.6 + ph * 0.9)
      c.visible = ph < 0.95
    })

    const k = 1 - Math.min(Math.max(P.lift * 1.6, 0) * 0.5, 0.3)
    shadowA.current?.scale.set(1.15 * k, 1.35 * k, 1)
    shadowB.current?.scale.set(1.9 * k, 2.2 * k, 1)

    if (!s.ready) {
      s.ready = true
      onReady?.()
    }
  })

  const { mats, geos } = kit
  const sh = spec.shell
  const legDefs: [number, number, number][] = [[-spec.hipX, spec.hipY, spec.hipF], [spec.hipX, spec.hipY, spec.hipF], [-spec.hipX, spec.hipY, spec.hipB], [spec.hipX, spec.hipY, spec.hipB]]
  const antLen = variant === 'o' ? 0.62 : variant === 'p' ? 0.5 : variant === 'q' ? 0.22 : 0.28
  const antPos = variant === 'p' ? ([0.2, 1.22, -1.12] as const) : onShell(sh, 0.22, -0.62).pos
  return (
    <group scale={S0} position={[0, GROUND, 0]}>
      <mesh ref={shadowB} material={kit.shadow2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><circleGeometry args={[1, 40]} /></mesh>
      <mesh ref={shadowA} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}><circleGeometry args={[1, 40]} /></mesh>
      <group ref={turn}>
        <group ref={lean}>
          <group ref={sq}>
            {/* shell, belly, rim */}
            <group position={[0, sh.y, sh.z]} scale={[sh.sx, sh.sy, sh.sz]}>
              <mesh geometry={geos.shell} material={kit.shell} />
            </group>
            <mesh material={mats.cream} position={[0, sh.y - (variant === 'o' ? 0.2 : 0.248) * sh.sy - 0.02, sh.z]} scale={[0.97 * sh.sx, 0.17, 0.97 * sh.sz]}><sphereGeometry args={[1, 40, 20]} /></mesh>
            <mesh material={mats.cream} position={[0, sh.y - (variant === 'o' ? 0.2 : 0.248) * sh.sy + 0.005, sh.z]} scale={[sh.sx * (variant === 'o' ? 0.96 : 0.969), 1, sh.sz * (variant === 'o' ? 0.96 : 0.969)]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1, 0.05, 10, 56]} /></mesh>

            {/* HQ: screens on the shell, lamps, antenna */}
            {spec.screens.map((sc, i) => {
              const o = onShell(sh, sc.x, sc.z)
              const m2 = variant === 'p' ? kit.scr.wide : [kit.scr.s0, kit.scr.s1, kit.scr.s2][sc.kind]!
              return (
                <group key={i} position={o.pos} quaternion={o.quat}>
                  <mesh material={mats.graphite}><boxGeometry args={[sc.w + 0.05, sc.h + 0.05, 0.04]} /></mesh>
                  <mesh material={m2} position={[0, 0, 0.022]}><planeGeometry args={[sc.w, sc.h]} /></mesh>
                </group>
              )
            })}
            {variant === 'p' ? (
              <group position={[0, 1.0, -1.08]} rotation={[0.25, 0, 0]}>
                <mesh material={mats.graphite}><boxGeometry args={[0.7, 0.55, 0.32]} /></mesh>
                <mesh material={mats.lime} position={[0, 0, 0.17]}><boxGeometry args={[0.6, 0.06, 0.02]} /></mesh>
                <mesh material={mats.cream} position={[0, -0.18, 0.17]}><boxGeometry args={[0.6, 0.05, 0.02]} /></mesh>
              </group>
            ) : null}
            {variant === 'q' ? (
              <group position={onShell(sh, 0, 0.5).pos} quaternion={onShell(sh, 0, 0.5).quat}>
                <mesh material={mats.cream}><boxGeometry args={[0.2, 0.09, 0.025]} /></mesh>
                <mesh material={mats.light} position={[0, 0, 0.015]}><boxGeometry args={[0.12, 0.02, 0.01]} /></mesh>
              </group>
            ) : null}
            {Array.from({ length: spec.lamps }).map((_, i) => (
              <mesh key={i} ref={(el) => void (lampRefs.current[i] = el)} material={kit.lamps[i]!} position={lampAt(variant, i, spec.lamps, kit)}><sphereGeometry args={[variant === 'p' ? 0.04 : 0.05, 14, 10]} /></mesh>
            ))}
            <group ref={ant} position={[antPos[0], antPos[1] - 0.02, antPos[2]]}>
              <mesh material={mats.graphite} position={[0, antLen / 2, 0]}><cylinderGeometry args={[0.014, 0.02, antLen, 8]} /></mesh>
              <mesh material={mats.light} position={[0, antLen + 0.03, 0]}><sphereGeometry args={[0.055, 18, 12]} /></mesh>
              {variant === 'o' ? <mesh material={mats.light} position={[0, antLen * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.012, 8, 24]} /></mesh> : null}
            </group>
            {accId === 'backpack' && variant === 'p' ? null : slots.body}

            {/* tail */}
            <group ref={tail} position={[0, 0.42, spec.tail]}>
              <mesh material={mats.lime} rotation={[-Math.PI / 2 - 0.2, 0, 0]} position={[0, 0, -0.12]}><coneGeometry args={[0.13, 0.4, 16]} /></mesh>
            </group>

            {/* legs */}
            {legDefs.map((d, i) => (
              <group key={i} ref={(el) => void (legs.current[i] = el)} position={d} rotation-order="YXZ">
                <mesh material={mats.lime} position={[0, -spec.leg / 2, 0]}><capsuleGeometry args={[spec.legR, spec.leg * 0.8, 6, 14]} /></mesh>
                {variant === 'o' ? (
                  <mesh material={mats.graphite} position={[0, -spec.leg * 0.72, 0]}><cylinderGeometry args={[spec.legR * 1.3, spec.legR * 1.3, 0.1, 20]} /></mesh>
                ) : null}
                {variant === 'o' ? <mesh material={mats.light} position={[0, -spec.leg * 0.72, 0]}><cylinderGeometry args={[spec.legR * 1.33, spec.legR * 1.33, 0.02, 20]} /></mesh> : null}
                {variant === 'p' ? (
                  <group position={[0, -spec.leg - 0.02, 0.07]}>
                    <mesh material={mats.cream} scale={[1, 0.75, 1.45]}><sphereGeometry args={[spec.legR * 1.35, 18, 12]} /></mesh>
                    <mesh material={mats.light} position={[0, -spec.legR * 0.8, 0]} scale={[1, 0.25, 1.5]}><sphereGeometry args={[spec.legR * 1.38, 16, 8]} /></mesh>
                  </group>
                ) : (
                  <mesh material={variant === 'q' ? mats.cream : mats.lime} position={[0, -spec.leg, 0.02]} scale={[1, 0.85, 1.15]}><sphereGeometry args={[spec.legR * 1.2, 18, 12]} /></mesh>
                )}
                {i < 2 ? (
                  <group ref={(el) => void (grips.current[i] = el)} position={[0, -spec.leg, 0]}>
                    <group position={[0, 0.24, 0.12]} rotation={[0, -0.5, 0]} scale={1.5}>{i === 0 ? slots.pawL ?? slots.pawR : slots.pawL ? slots.pawR : null}</group>
                  </group>
                ) : null}
              </group>
            ))}
            {slots.front}

            {/* head */}
            <group ref={head}>
              <mesh material={mats.lime} position={[0, 0, -0.05]} scale={[0.3, 0.3, 0.42]}><sphereGeometry args={[1, 24, 16]} /></mesh>
              {variant === 'q' ? [0.1, 0.24].map((z, i) => <mesh key={i} material={mats.lime} position={[0, 0, z - 0.1]}><torusGeometry args={[0.3 - i * 0.03, 0.03, 8, 24]} /></mesh>) : null}
              <group position={[0, 0.12, 0.38]}>
                <mesh material={mats.lime}><sphereGeometry args={[0.5, 56, 40]} /></mesh>
                <mesh geometry={geos.faceCap} material={kit.face} renderOrder={2} />
                {variant === 'o' && kit.visor && kit.mouthCap ? (
                  <>
                    <mesh geometry={geos.faceCap} material={kit.mouthCap} renderOrder={2} />
                    <mesh geometry={geos.visorCap} material={kit.visor} renderOrder={3} />
                  </>
                ) : null}
                {variant === 'q' && accId !== 'glasses' ? <Glasses m={mats} big /> : null}
                {slots.head}
              </group>
            </group>
            {slots.world ? <group>{slots.world}</group> : null}
          </group>
        </group>
      </group>
    </group>
  )
}

export default function FiraScene4({ variant, emotion, acc, lookAt, mouth, theme, active, clock, spin, event, lights, onReady }: Scene4Props) {
  const live = useRef<Live>({ emotion, acc, lookAt, mouth, clock, spin, event, lights })
  useEffect(() => {
    live.current = { emotion, acc, lookAt, mouth, clock, spin, event, lights }
  })
  return (
    <Canvas
      data-fira-canvas=""
      dpr={[1, 1.5]}
      resize={{ offsetSize: true }}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 3.1, 7.3], fov: 27 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      aria-hidden="true"
    >
      <Rig variant={variant} acc={acc} live={live} theme={theme} onReady={onReady} />
    </Canvas>
  )
}
