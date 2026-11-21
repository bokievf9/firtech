'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { readPalette, palettes, type Palette } from '@/lib/fira/palette'
import {
  BLINK_LEN, blinkClosed, blinkDelay, breathHz, channels, clampLook, feel, hopCurve, makeSprings,
  stepSpring, targets, volumeXZ, type Emotion,
} from '@/lib/fira/pose'
import { Char, type AnimFn, type Ctx } from './fira-chars'
import { driveFace, type FaceApi } from './fira-face'
import { makeKit2 } from './fira-kit2'
import { paintClay, paint, uni } from './materials'
import type { SceneProps } from './fira-scene'

// Round-two scene (variants d to h): one rig, five bodies. The shared frame loop steps the emotion
// springs, blink, hop, breathing, pointer and lip-sync, then lets the character animate its own parts
// (fira-chars.tsx) and drives the face (fira-face.tsx).
type Live = Pick<SceneProps, 'emotion' | 'lookAt' | 'mouth' | 'clock'> & { spin?: number }
type Perf = { n: number; ms: number }
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const GROUND = -1.62

type V2 = 'd' | 'e' | 'f' | 'g' | 'h'

function Rig({ variant, live, theme, onReady }: { variant: V2; live: React.RefObject<Live>; theme?: 'light' | 'dark'; onReady?: () => void }) {
  const kit = useMemo(() => makeKit2(variant), [variant])
  useEffect(() => () => kit.dispose(), [kit])

  useEffect(() => {
    const pal = (t?: 'light' | 'dark'): Palette => {
      const p = t ? palettes[t] : readPalette()
      kit.zMats.forEach((m) => {
        uni(m).uColor!.value.set(p.mark)
        uni(m).uShade!.value.set(p.mark)
      })
      for (const sh of [kit.shadow, kit.shadow2]) uni(sh).uColor!.value.set(p.dark ? p.accent : p.ink)
      uni(kit.shadow).uAlpha!.value = p.dark ? 0.3 : 0.26
      uni(kit.shadow2).uAlpha!.value = p.dark ? 0.12 : 0.1
      uni(kit.blush).uColor!.value.set(p.blush)
      uni(kit.halo).uColor!.value.set(p.strong)
      uni(kit.belly).uColor!.value.set(p.cream)
      uni(kit.belly).uAlpha!.value = 0.62
      uni(kit.hl).uColor!.value.set('#ffffff')
      uni(kit.hl).uAlpha!.value = p.dark ? 0.5 : 0.85
      return p
    }
    const apply = () => {
      const p = pal(theme)
      paintClay({ bodies: [kit.mats.body, kit.mats.flame], flame: kit.mats.flame, deep: kit.mats.deep, ink: kit.mats.ink, cream: kit.mats.cream, dot: kit.mats.dot, shell: kit.mats.shell, lids: [kit.lidL, kit.lidR], mouth: kit.mouth }, p)
      paint({ body: [], ink: [], cream: [], strong: [], mark: kit.zMats }, [kit.eye], p)
    }
    apply()
    if (theme) return
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [kit, theme])

  const spec = kit.spec
  const S = useRef({ sp: makeSprings(targets.idle), t: 0, ph: 0, nextBlink: 2.2, blinkT: -1, prev: 'idle' as Emotion, px: 0, py: 0, mo: 0, ready: false })
  const root = useRef<Group>(null), turn = useRef<Group>(null), sq = useRef<Group>(null), zRoot = useRef<Group>(null)
  const shadowA = useRef<Mesh>(null), shadowB = useRef<Mesh>(null)
  const anim = useRef<AnimFn | null>(null)
  const register = useCallback((fn: AnimFn | null) => {
    anim.current = fn
  }, [])
  const face = useRef<Partial<FaceApi>>({})

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
      P.squash.v += em === 'happy' ? -2.6 : em === 'surprised' ? 2.2 : -1.4
      s.prev = em
    }
    s.ph = L.clock !== undefined ? clock * breathHz[em] : s.ph + dt * breathHz[em]
    const breath = Math.sin(s.ph * Math.PI * 2) * P.breath.x

    const wgt = L.lookAt ? tg.pointer : 0
    const ptx = L.lookAt ? ptr.current.x * wgt : 0
    const pty = L.lookAt ? ptr.current.y * wgt : 0
    s.px += (ptx - s.px) * (1 - Math.exp(-dt * 9))
    s.py += (pty - s.py) * (1 - Math.exp(-dt * 9))

    const hop = P.hop.x > 0.02 ? hopCurve(clock) : { y: 0, sy: 1 }
    const hopK = clamp01(P.hop.x)
    const sy = P.squash.x * mix(1, hop.sy, hopK) * (1 + breath)
    const sxz = volumeXZ(sy)

    let m = L.mouth ?? 0
    if (L.mouth === undefined && em === 'talking') {
      m = clamp01(0.5 + 0.5 * Math.sin(clock * 11.5) * Math.sin(clock * 4.1 + 1) + 0.12)
    }
    s.mo += (m - s.mo) * (1 - Math.exp(-dt * (m > s.mo ? 28 : 12)))

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

    const r = root.current, q = sq.current, tn = turn.current
    if (!r || !q || !tn) return
    const sc = spec.scale
    r.scale.setScalar(sc)
    r.position.set(-P.lean.x * 0.28 * sc, GROUND + hop.y * 0.3 * hopK * sc, 0)
    r.rotation.z = -P.lean.x
    tn.rotation.y = L.spin ? s.t * L.spin : 0
    q.scale.set(sxz, sy, sxz)

    const pulse = em === 'thinking' ? 0.5 + 0.5 * Math.sin(clock * Math.PI * 1.6) : 1
    const glow = P.glow.x * pulse + s.mo * 0.4
    const ctx: Ctx = {
      P, em, clock, dt, sy, sxz, breath, px: s.px, py: s.py, mo: s.mo, hopY: hop.y, hopK, glow,
      pitch: P.pitch.x - s.py * 0.2 + breath * 0.5 + s.mo * 0.03,
      yaw: s.px * 0.34 + Math.sin(clock * 0.6) * 0.03 * (1 - clamp01(P.zzz.x)),
      roll: P.roll.x + s.px * -0.05,
    }
    anim.current?.(ctx)
    driveFace(face.current, kit, spec.face, { P, clock, open, mo: s.mo, px: s.px, py: s.py })

    // Contact shadow: a tight dark core and a wide soft one; both shrink with the hop.
    const k = 1 - Math.min(hop.y * hopK * 0.4, 0.4)
    shadowA.current?.scale.set(0.82 * spec.shadow * k * sxz, 0.82 * spec.shadow * k * sxz, 1)
    shadowB.current?.scale.set(1.25 * spec.shadow * k * sxz, 1.25 * spec.shadow * k * sxz, 1)

    // Zzz.
    for (let i = 0; i < 3; i++) {
      const g = zRoot.current?.children[i], zm = kit.zMats[i]
      if (!g || !zm) continue
      const ph = (clock * 0.32 + i / 3) % 1
      const a = Math.sin(Math.PI * ph) * clamp01(P.zzz.x)
      g.position.set(spec.zz[0] + ph * 0.32 + Math.sin(ph * 6) * 0.04, spec.zz[1] - 0.5 + ph * 0.95, 0.2)
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

  const { geos } = kit
  return (
    <group ref={root} scale={spec.scale} position={[0, GROUND, 0]}>
      <mesh ref={shadowB} geometry={geos.disc} material={kit.shadow2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} renderOrder={0} />
      <mesh ref={shadowA} geometry={geos.disc} material={kit.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={0} />
      <group ref={turn}>
        <group ref={sq}>
          <Char variant={variant} kit={kit} register={register} face={face} />
        </group>
        <group ref={zRoot}>
          {[0, 1, 2].map((i) => (
            <group key={i} visible={false}>
              <mesh geometry={geos.zbar} material={kit.zMats[i]} position={[0, 0.13, 0]} />
              <mesh geometry={geos.zbar} material={kit.zMats[i]} position={[0, -0.13, 0]} />
              <mesh geometry={geos.zdiag} material={kit.zMats[i]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function FiraScene2({ variant, emotion, lookAt, mouth, theme, active, clock, spin, onReady }: SceneProps) {
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
      <Rig variant={variant as V2} live={live} theme={theme} onReady={onReady} />
    </Canvas>
  )
}
