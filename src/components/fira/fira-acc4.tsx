'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Accessory } from '@/lib/fira/turtle'
import type { Kit4 } from './fira-kit4'

// Accessories are separate meshes. Each returns up to five slots: head (head-centre frame, head radius
// 0.5, facing +z), body (body frame, ground at y 0), paw (the tip of a front limb, upright), world
// (the floor beside the turtle) and the two-handed item that sits between the paws.
type Mats = Kit4['mats']
type Slots = { head?: ReactNode; body?: ReactNode; pawR?: ReactNode; pawL?: ReactNode; front?: ReactNode; world?: ReactNode }

function RBox({ s, r = 0.02, m }: { s: [number, number, number]; r?: number; m: Kit4['mats']['lime'] }) {
  const geo = useMemo(() => new RoundedBoxGeometry(s[0], s[1], s[2], 3, r), [s[0], s[1], s[2], r]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={m} />
}

export function accSlots(id: Accessory | undefined, k: Kit4): Slots {
  const m: Mats = k.mats
  if (!id) return {}
  switch (id) {
    case 'headphones':
      return {
        head: (
          <group position={[0, 0.02, -0.04]}>
            <mesh material={m.graphite}><torusGeometry args={[0.57, 0.034, 10, 48, Math.PI]} /></mesh>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <mesh material={m.graphite}><cylinderGeometry args={[0.17, 0.17, 0.11, 28]} /></mesh>
                <mesh material={m.light} position={[0, s * 0.06, 0]}><cylinderGeometry args={[0.1, 0.1, 0.02, 24]} /></mesh>
              </group>
            ))}
          </group>
        ),
      }
    case 'glasses':
      return { head: <Glasses m={m} /> }
    case 'phone':
      return {
        pawR: (
          <group position={[0, 0.04, 0.08]} rotation={[0.2, 0, -0.1]}>
            <RBox s={[0.17, 0.3, 0.03]} r={0.02} m={m.graphite} />
            <mesh position={[0, 0, 0.0165]}><planeGeometry args={[0.14, 0.26]} /><primitive object={k.scr.phone} attach="material" /></mesh>
          </group>
        ),
      }
    case 'laptop':
      return {
        world: (
          <group position={[-1.4, 0, 0.45]} rotation={[0, 0.5, 0]}>
            <RBox s={[0.92, 0.045, 0.62]} r={0.02} m={m.cream} />
            <group position={[0, 0.03, -0.3]} rotation={[-0.3, 0, 0]}>
              <group position={[0, 0.3, 0]}>
                <RBox s={[0.92, 0.6, 0.03]} r={0.02} m={m.graphite} />
                <mesh position={[0, 0.01, 0.0165]}><planeGeometry args={[0.82, 0.5]} /><primitive object={k.scr.laptop} attach="material" /></mesh>
                <mesh material={m.light} position={[0, 0, -0.018]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.01, 20]} /></mesh>
              </group>
            </group>
            <mesh material={m.graphite} position={[0, 0.026, 0.12]}><boxGeometry args={[0.7, 0.008, 0.26]} /></mesh>
          </group>
        ),
      }
    case 'coffee':
      return {
        world: (
          <group position={[1.45, 0, 0.5]} scale={1.5}>
            <mesh material={m.cream} position={[0, 0.15, 0]}><cylinderGeometry args={[0.15, 0.115, 0.3, 28]} /></mesh>
            <mesh material={m.light} position={[0, 0.14, 0]}><cylinderGeometry args={[0.153, 0.133, 0.09, 28]} /></mesh>
            <mesh material={m.graphite} position={[0, 0.31, 0]}><cylinderGeometry args={[0.16, 0.15, 0.03, 28]} /></mesh>
            <mesh material={m.cream} position={[0.18, 0.16, 0]}><torusGeometry args={[0.07, 0.022, 8, 20, Math.PI]} /></mesh>
            <group name="steam">{[0, 1, 2].map((i) => <mesh key={i} material={m.glass} position={[0, 0.4, 0]}><sphereGeometry args={[0.045, 12, 8]} /></mesh>)}</group>
          </group>
        ),
      }
    case 'pen+folder':
      return {
        pawL: <group position={[0, 0.02, 0.1]} rotation={[0.1, 0, 0.1]}><RBox s={[0.3, 0.4, 0.05]} r={0.025} m={m.cream} /><mesh material={m.lime} position={[0.07, 0.2, 0]}><boxGeometry args={[0.12, 0.05, 0.052]} /></mesh></group>,
        pawR: (
          <group position={[0, 0.0, 0.06]} rotation={[0, 0, 0.7]}>
            <mesh material={m.lime}><capsuleGeometry args={[0.022, 0.34, 4, 10]} /></mesh>
            <mesh material={m.graphite} position={[0, -0.21, 0]}><coneGeometry args={[0.02, 0.07, 10]} /></mesh>
          </group>
        ),
      }
    case 'magnifier':
      return {
        pawR: (
          <group position={[0, 0.0, 0.08]} rotation={[0.1, 0.2, 0.35]}>
            <mesh material={m.graphite}><cylinderGeometry args={[0.022, 0.026, 0.26, 10]} /></mesh>
            <group position={[0, 0.27, 0]}>
              <mesh material={m.lime}><torusGeometry args={[0.15, 0.025, 10, 32]} /></mesh>
              <mesh material={m.glass}><circleGeometry args={[0.15, 28]} /></mesh>
            </group>
          </group>
        ),
      }
    case 'backpack':
      return {
        body: (
          <group position={[0, 1.3, -0.95]} rotation={[0.35, 0, 0]} scale={1.2}>
            <RBox s={[0.62, 0.62, 0.3]} r={0.1} m={m.amber} />
            <mesh material={m.graphite} position={[0, 0.12, 0.16]}><boxGeometry args={[0.5, 0.2, 0.03]} /></mesh>
            <mesh material={m.light} position={[0, -0.12, 0.162]}><boxGeometry args={[0.12, 0.05, 0.01]} /></mesh>
          </group>
        ),
      }
    case 'hairdryer':
      return {
        pawR: (
          <group position={[0, 0.02, 0.1]} rotation={[0.3, 0, 0]}>
            <mesh material={m.lime} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.075, 0.26, 24]} /></mesh>
            <mesh material={m.graphite} position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.09, 0.07, 24]} /></mesh>
            <mesh material={m.graphite} position={[0, -0.14, -0.04]} rotation={[0.15, 0, 0]}><capsuleGeometry args={[0.04, 0.14, 4, 10]} /></mesh>
          </group>
        ),
      }
    case 'stethoscope':
      return {
        head: (
          <group position={[0, -0.5, -0.1]}>
            <mesh material={m.graphite} rotation={[Math.PI / 2 - 0.3, 0, 0]}><torusGeometry args={[0.42, 0.022, 8, 36]} /></mesh>
            <mesh material={m.graphite} position={[0, -0.2, 0.36]}><cylinderGeometry args={[0.013, 0.013, 0.4, 8]} /></mesh>
            <mesh material={m.light} position={[0, -0.42, 0.38]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.08, 0.08, 0.04, 20]} /></mesh>
          </group>
        ),
      }
    case 'tray':
      return {
        front: (
          <group position={[-0.55, 0.5, 1.75]} rotation={[-0.15, 0, 0]} scale={1.1}>
            <mesh material={m.cream}><cylinderGeometry args={[0.4, 0.38, 0.035, 36]} /></mesh>
            <mesh material={m.amber} position={[-0.12, 0.1, 0]}><cylinderGeometry args={[0.07, 0.055, 0.14, 20]} /></mesh>
            <mesh material={m.lime} position={[0.15, 0.07, 0.05]}><sphereGeometry args={[0.08, 18, 12]} /></mesh>
          </group>
        ),
      }
    case 'wrench':
      return {
        pawR: (
          <group position={[0, 0, 0.08]} rotation={[0.1, 0, 0.5]}>
            <mesh material={m.graphite}><capsuleGeometry args={[0.03, 0.4, 4, 10]} /></mesh>
            <mesh material={m.lime} position={[0, 0.27, 0]}><torusGeometry args={[0.07, 0.032, 8, 20, Math.PI * 1.6]} /></mesh>
          </group>
        ),
      }
    case 'book':
      return {
        front: (
          <group position={[-0.7, 0.3, 2.0]} rotation={[-0.5, -0.5, 0]} scale={1.2}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.13, 0, 0]} rotation={[0, 0, -s * 0.28]}>
                <mesh material={m.lime} position={[0, -0.02, 0]}><boxGeometry args={[0.27, 0.03, 0.36]} /></mesh>
                <mesh material={m.cream} position={[0, 0.005, 0]}><boxGeometry args={[0.25, 0.03, 0.34]} /></mesh>
              </group>
            ))}
          </group>
        ),
      }
    case 'bag':
      return {
        pawL: (
          <group position={[0, -0.08, 0.1]}>
            <RBox s={[0.28, 0.32, 0.15]} r={0.03} m={m.lime} />
            <mesh material={m.cream} position={[0, 0.17, 0]}><torusGeometry args={[0.07, 0.014, 8, 18, Math.PI]} /></mesh>
            <mesh material={m.graphite} position={[0, -0.02, 0.078]}><boxGeometry args={[0.1, 0.1, 0.006]} /></mesh>
          </group>
        ),
      }
  }
}

export function Glasses({ m, big = false }: { m: Mats; big?: boolean }) {
  const r = big ? 0.105 : 0.115
  return (
    <group position={[0, 0.07, 0.465]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.185, 0, 0]}>
          <mesh material={big ? m.amber : m.graphite}><torusGeometry args={[r, big ? 0.012 : 0.017, 8, 32]} /></mesh>
          <mesh material={m.glass}><circleGeometry args={[r, 24]} /></mesh>
          <mesh material={m.graphite} position={[s * (r + 0.02), 0, -0.12]} rotation={[0, Math.PI / 2 + s * 0.15, 0]}><cylinderGeometry args={[0.009, 0.009, 0.26, 6]} /></mesh>
        </group>
      ))}
      <mesh material={m.graphite} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.011, 0.1, 4, 8]} /></mesh>
    </group>
  )
}
