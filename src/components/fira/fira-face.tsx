'use client'

import { useEffect, useMemo, type RefObject } from 'react'
import type { Group, Mesh } from 'three'
import { mouthShape, type Channel, type Spring } from '@/lib/fira/pose'
import { onSurface } from './fira-kit'
import type { FaceLayout, Kit2 } from './fira-kit2'
import { uni } from './materials'

// The round-two face: Pixar-style eyes (dark iris, two highlights, lighter lower rim), an upper lid
// and a brow as separate meshes per eye so emotions read (lid tilt, one brow up, wide eyes), a
// five-shape mouth decal and cheeks. All are decals or small meshes placed on the body's lathe
// profile; the scene's frame loop drives them with `driveFace`.
export type FaceApi = { eyes: Group; browL: Mesh; browR: Mesh; blushL: Mesh; blushR: Mesh }

export function Face({ kit, layout, api }: { kit: Kit2; layout: FaceLayout; api: RefObject<Partial<FaceApi>> }) {
  const place = useMemo(() => {
    const { profile: p, eye: e, cheek: ck, lift } = layout
    const phi = Math.asin(Math.min(0.95, e.x / p.r(e.y)))
    const ph2 = Math.asin(Math.min(0.95, ck.x / p.r(ck.y)))
    return {
      eyeL: onSurface(p, e.y, -phi, 0.014 + lift),
      eyeR: onSurface(p, e.y, phi, 0.014 + lift),
      mouth: onSurface(p, layout.mouthY, 0, 0.006 + lift),
      cheekL: onSurface(p, ck.y, -ph2, 0.01 + lift),
      cheekR: onSurface(p, ck.y, ph2, 0.01 + lift),
    }
  }, [layout])
  const { geos } = kit
  const s = layout.eye.s
  const o = layout.order
  const set = (k: keyof FaceApi) => (m: Group | Mesh | null) => {
    if (m) (api.current as Record<string, unknown>)[k] = m
  }
  useEffect(() => () => void (api.current = {}), [api])
  return (
    <>
      <group ref={set('eyes')}>
        {([-1, 1] as const).map((side) => {
          const pl = side < 0 ? place.eyeL : place.eyeR
          return (
            <group key={side} position={pl.position} quaternion={pl.quaternion}>
              <mesh geometry={geos.plane} material={kit.eye} scale={[s, s, 1]} renderOrder={o} />
              <mesh geometry={geos.plane} material={side < 0 ? kit.lidL : kit.lidR} scale={[s, s, 1]} position={[0, 0, 0.004]} renderOrder={o + 1} />
              <mesh ref={set(side < 0 ? 'browL' : 'browR')} geometry={geos.brow} material={kit.mats.ink} position={[0, s * 1.4, 0.03]} scale={[s * 0.82, s * 0.82, s * 0.5]} />
            </group>
          )
        })}
      </group>
      {([-1, 1] as const).map((side) => {
        const pl = side < 0 ? place.cheekL : place.cheekR
        return <mesh key={side} ref={set(side < 0 ? 'blushL' : 'blushR')} geometry={geos.plane} material={kit.blush} position={pl.position} quaternion={pl.quaternion} scale={[0.23, 0.15, 1]} renderOrder={o - 1} />
      })}
      <mesh geometry={geos.plane} material={kit.mouth} position={place.mouth.position} quaternion={place.mouth.quaternion} scale={[layout.mouthS, layout.mouthS, 1]} renderOrder={o} />
    </>
  )
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export type FaceFrame = {
  P: Record<Channel, Spring>
  clock: number
  open: number // 0..1 after blink
  mo: number // lip-sync amplitude
  px: number
  py: number
}

export function driveFace(api: Partial<FaceApi>, kit: Kit2, layout: FaceLayout, f: FaceFrame) {
  const { P } = f
  const eyes = api.eyes
  if (!eyes) return
  eyes.position.set(P.lookX.x * 0.07 + f.px * 0.06, P.lookY.x * 0.06 + f.py * 0.05, 0)

  // Eyes: wide scale, blink, happy and sleepy arches (moon), the lid hidden while arched.
  const eu = uni(kit.eye)
  const moon = P.moon.x
  const wide = 1 + (P.wide.x - 1) * layout.wideK
  eu.uScale!.value = wide
  eu.uOpen!.value = Math.max(f.open, 0.07)
  eu.uLid!.value = 0
  eu.uMoon!.value = moon >= 0 ? Math.min(1, moon) : Math.min(1, -moon)
  eu.uThick!.value = moon >= 0 ? 0.17 : 0.12
  eu.uDir!.value = moon >= 0 ? 1 : -1

  const lidOn = 1 - clamp01(Math.abs(moon) * 1.6)
  for (const [m, side] of [[kit.lidL, -1], [kit.lidR, 1]] as const) {
    const u = uni(m)
    const split = side > 0 ? P.browSplit.x * 0.28 : 0
    u.uLid!.value = clamp01(P.lid.x + layout.lidBias + split) * (1 - (wide - 1) * 2)
    u.uTilt!.value = P.lidTilt.x + layout.lidTilt
    u.uScale!.value = wide
    u.uOn!.value = lidOn * (u.uLid!.value > 0.01 ? 1 : 0)
  }

  // Brows: lift, tilt (positive: inner ends down), one raised (the left) while thinking.
  const s = layout.eye.s
  for (const [b, side] of [[api.browL, -1], [api.browR, 1]] as const) {
    if (!b) continue
    const up = P.browY.x + (side < 0 ? P.browSplit.x * 0.9 : -P.browSplit.x * 0.25)
    b.position.y = s * (1.02 * wide + 0.34 + layout.browLift * 0.1 + up * 0.5)
    b.rotation.z = (P.browTilt.x * 0.7 + (side < 0 ? P.browSplit.x * 0.12 : 0)) * side
    const sc = s * 0.82 * (1 + Math.max(P.browY.x, 0) * 0.05)
    b.scale.set(sc, sc * (1 + P.browSplit.x * (side < 0 ? 0.1 : 0)), s * 0.5)
    b.visible = true
  }

  // Cheeks.
  const bk = clamp01(P.blush.x) * layout.cheek.k
  uni(kit.blush).uAlpha!.value = 0.75 * bk
  if (api.blushL) api.blushL.visible = bk > 0.02
  if (api.blushR) api.blushR.visible = bk > 0.02

  // Mouth: smile arc, grin, round O or a lip-sync viseme, whichever is most open.
  const ms = mouthShape(P.smile.x * (1 + P.grin.x * 0.2), clamp01(P.grin.x), clamp01(P.mouthO.x), f.mo, f.clock * 9)
  const mu = uni(kit.mouth)
  mu.uOpen!.value = ms.open
  mu.uW!.value = mix(mu.uW!.value, ms.w, 0.5)
  mu.uH!.value = mix(mu.uH!.value, ms.h, 0.5)
  mu.uSmile!.value = ms.smile
  mu.uFlat!.value = ms.flat
  mu.uTongueAmt!.value = ms.tongue
}
