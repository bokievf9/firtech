'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { Group, Mesh } from 'three'
import { stepSpring, type Channel, type Emotion, type Spring } from '@/lib/fira/pose'
import { Face, type FaceApi } from './fira-face'
import { FLAME_H, FLAME_R, SEED_H, DROP_H, type Kit2 } from './fira-kit2'
import { uni } from './materials'

// The five round-two characters. Each is a plain component (geometry, no state) that registers one
// animator, called from the scene's single frame loop after the shared pose is computed.
//   D «Огонёк»   flame head on a round body, the dot glows at the tip
//   E «Зёрнышко» a seed with a leaf tuft, sleepy lids, short legs, waddles
//   F «Шарик-с-телом» a big round head on a small body with hands and feet, the dot on the chest
//   G «Каплюшка-кот» a drop with ear bumps and a tail, the dot on the forehead
//   H «Пузырёк»  a translucent shell around a small solid core that wears the face
export type Ctx = {
  P: Record<Channel, Spring>
  em: Emotion
  clock: number
  dt: number
  sy: number
  sxz: number
  breath: number
  px: number
  py: number
  mo: number
  hopY: number
  hopK: number
  glow: number
  /** head rotation: pointer, pitch, roll already mixed */
  pitch: number
  yaw: number
  roll: number
}
export type AnimFn = (c: Ctx) => void
export type CharProps = { kit: Kit2; register: (fn: AnimFn | null) => void; face: RefObject<Partial<FaceApi>> }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Arm angle (z rotation, 0 = pointing right, negative = down): hanging, pointing, both up (cheer),
// the right one waving. Returns right and left rotations and a length scale each.
function armPose(c: Ctx, rest: number) {
  const { P, clock } = c
  const wig = Math.sin(clock * 9) * 0.16 * P.cheer.x
  const wv = P.wave.x * (2.5 + Math.sin(clock * 8.5) * 0.4)
  const r = rest + P.arm.x * 1.35 + P.cheer.x * 2.15 + wig + wv
  const l = Math.PI - (rest + P.cheer.x * 2.15 - wig)
  const lenR = 0.9 + P.arm.x * 0.25 + P.cheer.x * 0.3 + P.wave.x * 0.25
  const lenL = 0.9 + P.cheer.x * 0.3
  return { r, l, lenR, lenL }
}

function applyArms(c: Ctx, rest: number, r: Group | null, l: Group | null) {
  if (!r || !l) return
  const a = armPose(c, rest)
  r.rotation.z = a.r
  r.scale.set(a.lenR, 1, 1)
  l.rotation.z = a.l
  l.scale.set(a.lenL, 1, 1)
}

// A glowing dot: a bright cream-lime core that follows glow, with a soft halo behind.
function pulseDot(kit: Kit2, dot: Mesh | null, halo: Mesh | null, c: Ctx, base: [number, number, number], haloBase: number) {
  const g = c.glow
  uni(kit.mats.dot).uGlow!.value = 0.12 + g * 0.3
  uni(kit.halo).uAlpha!.value = 0.2 + g * 0.5
  if (dot) dot.scale.set(base[0], base[1], base[2]).multiplyScalar(1 + g * 0.16)
  if (halo) halo.scale.setScalar(haloBase * (0.8 + g * 0.35))
}

/* ---------------------------------------------------------------- D */
export function CharD({ kit, register, face }: CharProps) {
  const { geos, mats, spec } = kit
  const headR = useRef<Group>(null), body = useRef<Group>(null), armR = useRef<Group>(null), armL = useRef<Group>(null)
  const dot = useRef<Mesh>(null), halo = useRef<Mesh>(null), tip = useRef<Group>(null)
  const spr = useRef<Spring>({ x: 0, v: 0 })
  useEffect(() => {
    register((c) => {
      const h = headR.current
      if (h) h.rotation.set(c.pitch, c.yaw, c.roll)
      // The flame leans away from the way the head turns, flickers, and its tip lags (secondary spring).
      stepSpring(spr.current, -c.roll * 1.4 - c.P.lean.x * 1.2 - c.hopY * 0.0, c.dt, 55, 0.22)
      spr.current.v += (c.sy - 1) * -0.9
      const bend = 0.34 + spr.current.x * 0.6 + Math.sin(c.clock * 2.3) * 0.025 + Math.sin(c.clock * 5.1) * 0.012
      uni(mats.flame).uBend!.value = bend
      const u = FLAME_H - 0.7
      if (tip.current) tip.current.position.set(bend * u * u, FLAME_H, 0.02)
      pulseDot(kit, dot.current, halo.current, c, [0.15, 0.15, 0.15], 0.62)
      if (body.current) body.current.rotation.z = -c.roll * 0.25 - c.P.lean.x * 0.4
      applyArms(c, -1.15, armR.current, armL.current)
    })
    return () => register(null)
  }, [register, kit, mats])
  return (
    <>
      <group ref={body} position={[0, 0.7, 0]}>
        <mesh geometry={geos.ball} material={mats.body} scale={[0.76, 0.7, 0.72]} />
        <mesh geometry={geos.disc} material={kit.belly} position={[0, -0.14, 0.725]} scale={[0.34, 0.32, 1]} rotation={[0.12, 0, 0]} renderOrder={1} />
        {([1, -1] as const).map((sd) => (
          <mesh key={sd} geometry={geos.ball} material={mats.deep} position={[sd * 0.3, -0.62, 0.22]} scale={[0.2, 0.12, 0.27]} />
        ))}
      </group>
      {([1, -1] as const).map((sd) => (
        <group key={sd} ref={sd > 0 ? armR : armL} position={[sd * 0.66, 0.78, 0.1]}>
          <mesh geometry={geos.arm.d} material={mats.body} />
        </group>
      ))}
      <group ref={headR} position={[0, 1.38, 0]}>
        <group position={[0, -FLAME_R, 0]}>
          <mesh geometry={geos.flame} material={mats.flame} />
          <Face kit={kit} layout={spec.face} api={face} />
          <group ref={tip}>
            <mesh ref={halo} geometry={geos.plane} material={kit.halo} position={[0, 0.06, 0.03]} scale={0.62} renderOrder={5} />
            <mesh ref={dot} geometry={geos.ball} material={mats.dot} position={[0, 0.06, 0]} scale={0.15} />
          </group>
        </group>
      </group>
    </>
  )
}

/* ---------------------------------------------------------------- E */
export function CharE({ kit, register, face }: CharProps) {
  const { geos, mats, spec } = kit
  const sway = useRef<Group>(null), seed = useRef<Group>(null), legL = useRef<Group>(null), legR = useRef<Group>(null)
  const armR = useRef<Group>(null), armL = useRef<Group>(null), leafL = useRef<Group>(null), leafR = useRef<Group>(null)
  const dot = useRef<Mesh>(null), halo = useRef<Mesh>(null)
  const lag = useRef<Spring>({ x: 0, v: 0 })
  useEffect(() => {
    register((c) => {
      const w = c.P.waddle.x
      const ph = c.clock * 5.4
      const s = Math.sin(ph)
      if (sway.current) {
        sway.current.rotation.z = s * 0.1 * w - c.P.lean.x * 0.5
        sway.current.position.set(s * 0.05 * w + c.P.lean.x * 0.2, Math.abs(s) * 0.06 * w, 0)
      }
      if (seed.current) seed.current.rotation.set(c.pitch * 0.8, c.yaw * 0.9, c.roll)
      if (legL.current) legL.current.position.y = Math.max(0, s) * 0.14 * w
      if (legR.current) legR.current.position.y = Math.max(0, -s) * 0.14 * w
      stepSpring(lag.current, -c.roll * 1.2 + s * 0.15 * w, c.dt, 70, 0.28)
      lag.current.v += (c.sy - 1) * -0.8
      const flap = c.P.ear.x
      if (leafL.current) leafL.current.rotation.z = 0.78 + lag.current.x * 0.6 - flap * 0.18 + Math.sin(c.clock * 2.1) * 0.04
      if (leafR.current) leafR.current.rotation.z = -0.78 + lag.current.x * 0.6 + flap * 0.18 - Math.sin(c.clock * 2.4) * 0.04
      pulseDot(kit, dot.current, halo.current, c, [0.1, 0.1, 0.1], 0.34)
      applyArms(c, -1.2, armR.current, armL.current)
    })
    return () => register(null)
  }, [register, kit, mats])
  return (
    <group ref={sway} position={[0, 0, 0]}>
      {([1, -1] as const).map((sd) => (
        <group key={sd} ref={sd > 0 ? legR : legL} position={[sd * 0.38, 0.0, 0.05]}>
          <mesh geometry={geos.ball} material={mats.deep} position={[0, 0.17, 0.1]} scale={[0.24, 0.17, 0.32]} />
        </group>
      ))}
      <group ref={seed} position={[0, 0.2, 0]}>
        <mesh geometry={geos.seed} material={mats.body} />
        <Face kit={kit} layout={spec.face} api={face} />
        {([1, -1] as const).map((sd) => (
          <group key={sd} ref={sd > 0 ? armR : armL} position={[sd * 0.88, 0.7, 0.1]}>
            <mesh geometry={geos.arm.e} material={mats.body} />
          </group>
        ))}
        <group position={[0, SEED_H - 0.04, 0]}>
          <group ref={leafL} position={[-0.03, 0, 0]} rotation={[0, 0, 0.78]}>
            <mesh geometry={geos.petal} material={mats.deep} scale={[0.52, 0.66, 0.16]} position={[0, 0.0, 0]} />
          </group>
          <group ref={leafR} position={[0.03, 0, 0]} rotation={[0, 0, -0.78]}>
            <mesh geometry={geos.petal} material={mats.deep} scale={[0.52, 0.66, 0.16]} />
          </group>
          <mesh ref={halo} geometry={geos.plane} material={kit.halo} position={[0, 0.2, 0.12]} scale={0.34} renderOrder={5} />
          <mesh ref={dot} geometry={geos.ball} material={mats.dot} position={[0, 0.2, 0.06]} scale={0.1} />
        </group>
      </group>
    </group>
  )
}

/* ---------------------------------------------------------------- F */
export function CharF({ kit, register, face }: CharProps) {
  const { geos, mats, spec } = kit
  const head = useRef<Group>(null), body = useRef<Group>(null), armR = useRef<Group>(null), armL = useRef<Group>(null)
  const handR = useRef<Mesh>(null), handL = useRef<Mesh>(null), dot = useRef<Mesh>(null), halo = useRef<Mesh>(null)
  const footL = useRef<Mesh>(null), footR = useRef<Mesh>(null)
  useEffect(() => {
    register((c) => {
      if (head.current) {
        head.current.rotation.set(c.pitch, c.yaw, c.roll)
        head.current.position.set(c.roll * -0.18, 1.45, 0)
      }
      if (body.current) body.current.rotation.z = c.roll * 0.35 + c.P.lean.x * -0.3
      const w = c.P.waddle.x
      const s = Math.sin(c.clock * 5)
      if (footL.current) footL.current.position.y = 0.1 + Math.max(0, s) * 0.08 * w * 0.6
      if (footR.current) footR.current.position.y = 0.1 + Math.max(0, -s) * 0.08 * w * 0.6
      applyArms(c, -1.3, armR.current, armL.current)
      const a = armPose(c, -1.3)
      if (handR.current) handR.current.position.x = 0.46 * a.lenR
      if (handL.current) handL.current.position.x = 0.46 * a.lenL
      pulseDot(kit, dot.current, halo.current, c, [0.14, 0.14, 0.06], 0.5)
    })
    return () => register(null)
  }, [register, kit])
  return (
    <>
      {([1, -1] as const).map((sd) => (
        <mesh key={sd} ref={sd > 0 ? footR : footL} geometry={geos.ball} material={mats.deep} position={[sd * 0.27, 0.1, 0.12]} scale={[0.22, 0.12, 0.32]} />
      ))}
      <group ref={body} position={[0, 0.06, 0]}>
        <mesh geometry={geos.pear} material={mats.body} />
        <mesh geometry={geos.disc} material={kit.belly} position={[0, 0.5, 0.5]} scale={[0.26, 0.26, 1]} renderOrder={1} />
        <mesh ref={halo} geometry={geos.plane} material={kit.halo} position={[0, 0.5, 0.54]} scale={0.5} renderOrder={2} />
        <mesh ref={dot} geometry={geos.ball} material={mats.dot} position={[0, 0.5, 0.52]} scale={[0.14, 0.14, 0.06]} />
        {([1, -1] as const).map((sd) => (
          <group key={sd} ref={sd > 0 ? armR : armL} position={[sd * 0.44, 0.74, 0.04]}>
            <mesh geometry={geos.arm.f} material={mats.body} />
            <mesh ref={sd > 0 ? handR : handL} geometry={geos.ball} material={mats.body} position={[0.46, 0, 0]} scale={0.15} />
          </group>
        ))}
      </group>
      <group ref={head} position={[0, 1.45, 0]}>
        <mesh geometry={geos.ball} material={mats.body} scale={0.86} />
        <group scale={0.86}>
          <Face kit={kit} layout={spec.face} api={face} />
        </group>
      </group>
    </>
  )
}

/* ---------------------------------------------------------------- G */
const TAIL_N = 10
export function CharG({ kit, register, face }: CharProps) {
  const { geos, mats, spec } = kit
  const body = useRef<Group>(null), earL = useRef<Group>(null), earR = useRef<Group>(null)
  const armR = useRef<Group>(null), armL = useRef<Group>(null), dot = useRef<Mesh>(null), halo = useRef<Mesh>(null)
  const tail = useRef<Group>(null)
  useEffect(() => {
    register((c) => {
      if (body.current) body.current.rotation.set(c.pitch * 0.9, c.yaw, c.roll)
      const e = c.P.ear.x
      const flickL = Math.pow(Math.max(0, Math.sin(c.clock * 0.9)), 30)
      const flickR = Math.pow(Math.max(0, Math.sin(c.clock * 0.9 + 2.3)), 30)
      const base = 0.5 + Math.max(-e, 0) * 0.7 - Math.max(e, 0) * 0.12
      if (earL.current) earL.current.rotation.z = base + flickL * 0.35 + c.P.earSplit.x * 0.2 - c.px * 0.12
      if (earR.current) earR.current.rotation.z = -(base + flickR * 0.35 - c.P.earSplit.x * 0.2) - c.px * 0.12
      // Tail: eight soft segments; a gentle sway, and the curl channel winds it up (happy: a hook).
      const curl = c.P.tail.x
      const wag = Math.sin(c.clock * (2.2 + 6 * clamp01(c.P.cheer.x + c.P.wave.x))) * (0.1 + 0.18 * clamp01(c.P.cheer.x + c.P.wave.x))
      let a = 0.0 + wag + (c.em === 'sleep' ? -0.3 : 0)
      let x = 0, y = 0
      const t = tail.current
      if (t) {
        for (let i = 0; i < TAIL_N; i++) {
          const seg = t.children[i]
          if (!seg) continue
          seg.position.set(x, y, 0)
          const k = (i + 1) / TAIL_N
          a += (0.03 + 0.4 * curl) * (0.5 + k)
          x += Math.cos(a) * 0.125
          y += Math.sin(a) * 0.125
        }
      }
      pulseDot(kit, dot.current, halo.current, c, [0.1, 0.1, 0.05], 0.36)
      applyArms(c, -1.15, armR.current, armL.current)
    })
    return () => register(null)
  }, [register, kit])
  return (
    <group position={[-0.24, 0, 0]}>
      <group position={[0.78, 0.34, -0.1]}>
        <group ref={tail}>
          {Array.from({ length: TAIL_N }, (_, i) => (
            <mesh key={i} geometry={geos.ball} material={i > TAIL_N - 3 ? mats.deep : mats.body} scale={0.15 - i * 0.0065} />
          ))}
        </group>
      </group>
      {([1, -1] as const).map((sd) => (
        <mesh key={sd} geometry={geos.ball} material={mats.deep} position={[sd * 0.3, 0.1, 0.62]} scale={[0.19, 0.12, 0.25]} />
      ))}
      <group ref={body} position={[0, 0.06, 0]}>
        <mesh geometry={geos.catDrop} material={mats.body} />
        <mesh geometry={geos.disc} material={kit.belly} position={[0, 0.3, 0.95]} scale={[0.3, 0.24, 1]} rotation={[-0.1, 0, 0]} renderOrder={1} />
        <Face kit={kit} layout={spec.face} api={face} />
        {([1, -1] as const).map((sd) => (
          <group key={sd} ref={sd > 0 ? earR : earL} position={[sd * 0.46, DROP_H - 0.34, 0]} rotation={[0, 0, sd * -0.5]}>
            <mesh geometry={geos.petal} material={mats.body} scale={[0.52, 0.62, 0.34]} position={[0, -0.05, 0]} />
            <mesh geometry={geos.petal} material={mats.deep} scale={[0.3, 0.4, 0.2]} position={[0, 0.02, 0.08]} />
          </group>
        ))}
        {([1, -1] as const).map((sd) => (
          <group key={sd} ref={sd > 0 ? armR : armL} position={[sd * 0.92, 0.62, 0.1]}>
            <mesh geometry={geos.arm.g} material={mats.body} />
          </group>
        ))}
        <mesh ref={halo} geometry={geos.plane} material={kit.halo} position={[0, 1.42, spec.face.profile.r(1.42) + 0.03]} scale={0.3} renderOrder={5} />
        <mesh ref={dot} geometry={geos.ball} material={mats.dot} position={[0, 1.42, spec.face.profile.r(1.42) + 0.01]} scale={[0.1, 0.1, 0.05]} />
      </group>
    </group>
  )
}

/* ---------------------------------------------------------------- H */
export function CharH({ kit, register, face }: CharProps) {
  const { geos, mats, spec } = kit
  const shell = useRef<Group>(null), core = useRef<Group>(null), inner = useRef<Group>(null)
  const armR = useRef<Group>(null), armL = useRef<Group>(null)
  const lag = useRef<Spring>({ x: 0, v: 0 })
  const lagX = useRef<Spring>({ x: 0, v: 0 })
  useEffect(() => {
    register((c) => {
      // The shell wobbles slowly; the core follows its own springs, so it sways and lags inside.
      if (shell.current) shell.current.rotation.set(c.pitch * 0.3, c.yaw * 0.4, c.roll * 0.4)
      stepSpring(lag.current, -(c.sy - 1) * 0.5 - c.hopY * 0.15, c.dt, 80, 0.3)
      stepSpring(lagX.current, -c.roll * 0.6 - c.P.lean.x * 0.5, c.dt, 70, 0.28)
      const cs = 1 / Math.pow(c.sxz, 0.75)
      const cy = 1 / Math.pow(c.sy, 0.75)
      if (core.current) {
        core.current.position.set(lagX.current.x * 0.5 + c.px * 0.08, -0.14 + lag.current.x * 0.5 + Math.sin(c.clock * 1.5) * 0.02, 0)
        core.current.scale.set(cs, cy, cs)
      }
      if (inner.current) inner.current.rotation.set(c.pitch * 1.2, c.yaw * 1.5, c.roll * 1.1)
      uni(mats.dot).uGlow!.value = 0.1
      uni(mats.body).uGlow!.value = 0.08 + c.glow * 0.22
      applyArms(c, -1.3, armR.current, armL.current)
    })
    return () => register(null)
  }, [register, kit, mats])
  return (
    <group position={[0, 1.12, 0]}>
      <group ref={core}>
        <group ref={inner} scale={0.6}>
          <mesh geometry={geos.ball} material={mats.body} renderOrder={0} />
          <Face kit={kit} layout={spec.face} api={face} />
        </group>
        {([1, -1] as const).map((sd) => (
          <group key={sd} ref={sd > 0 ? armR : armL} position={[sd * 0.58, -0.02, 0.1]}>
            <mesh geometry={geos.arm.h} material={mats.body} />
          </group>
        ))}
      </group>
      <group ref={shell}>
        <mesh geometry={geos.ball} material={mats.shell} scale={1.1} renderOrder={2} />
        <mesh geometry={geos.plane} material={kit.hl} position={[-0.5, 0.64, 0.84]} rotation={[0.1, -0.35, 0.62]} scale={[0.3, 0.075, 1]} renderOrder={3} />
        <mesh geometry={geos.plane} material={kit.hl} position={[-0.7, 0.36, 0.8]} rotation={[0, -0.6, 0]} scale={[0.06, 0.06, 1]} renderOrder={3} />
      </group>
    </group>
  )
}

// One character by variant letter (a component, so the scene does not build components in render).
export function Char({ variant, ...props }: CharProps & { variant: 'd' | 'e' | 'f' | 'g' | 'h' }) {
  switch (variant) {
    case 'd': return <CharD {...props} />
    case 'e': return <CharE {...props} />
    case 'f': return <CharF {...props} />
    case 'g': return <CharG {...props} />
    default: return <CharH {...props} />
  }
}
