'use client'

import { useEffect, useRef } from 'react'
import type { EchoState } from '@/lib/echo'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// The assistant's hologram: a point-cloud sphere over a projector, drawn on a canvas. State shows
// in its motion (calm spin, ripples while thinking, a surface that follows the voice), so the
// owner can tell at a glance whether Echo is listening, thinking or talking.
// `level` is a 0..1 voice level the console writes (microphone or speech), read every frame.

type Tuning = { spin: number; amp: number; ripple: number; glow: number; white: number }

// Where each state settles; the frame loop eases toward it, so changes blend instead of jumping.
const tuning: Record<EchoState, Tuning> = {
  idle: { spin: 0.18, amp: 0.025, ripple: 0, glow: 0.45, white: 0 },
  listening: { spin: 0.12, amp: 0.02, ripple: 0, glow: 0.7, white: 0.45 },
  thinking: { spin: 1.1, amp: 0.03, ripple: 1, glow: 0.8, white: 0.1 },
  speaking: { spin: 0.3, amp: 0.04, ripple: 0, glow: 0.9, white: 0.2 },
}

const LIME = [181, 235, 106] as const
const WHITE = [236, 255, 214] as const
const POINTS = 1500

// Evenly spread points on a unit sphere (Fibonacci lattice), with latitude and longitude kept for
// the surface waves.
function lattice(count: number) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const lon = golden * i
    return { x: Math.cos(lon) * r, y, z: Math.sin(lon) * r, lat: Math.asin(y), lon }
  })
}

export function Hologram({
  state,
  level,
  className,
}: {
  state: EchoState
  level: { current: number }
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const reduce = useReducedMotion()
  const reduceRef = useRef(reduce)

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    reduceRef.current = reduce
  }, [reduce])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const points = lattice(POINTS)
    const now: Tuning = { ...tuning.idle }
    let w = 0
    let h = 0
    let dpr = 1
    let t = 0
    let angle = 0
    let voice = 0
    let tilt = { x: 0, y: 0 }
    let tiltTarget = { x: 0, y: 0 }
    let frame = 0
    let last = performance.now()

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = box.width
      h = box.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    // Decorative tilt toward the pointer, mouse only (a tap is not a hover).
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onMove = (e: PointerEvent) => {
      if (!fine.matches || reduceRef.current) return
      const box = canvas.getBoundingClientRect()
      tiltTarget = {
        x: ((e.clientY - box.top) / box.height - 0.5) * 0.35,
        y: ((e.clientX - box.left) / box.width - 0.5) * 0.5,
      }
    }
    const onLeave = () => (tiltTarget = { x: 0, y: 0 })
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const rgba = (mix: number, alpha: number) => {
      const c = LIME.map((v, i) => Math.round(v + ((WHITE[i] ?? v) - v) * mix))
      return `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`
    }

    const draw = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000)
      last = time
      const calm = reduceRef.current
      const target = tuning[stateRef.current]
      // Exponential ease toward the state's tuning: about a third of a second to settle.
      const k = 1 - Math.exp(-dt * 6)
      for (const key of Object.keys(now) as (keyof Tuning)[]) now[key] += (target[key] - now[key]) * k
      voice += (Math.min(1, level.current) - voice) * (1 - Math.exp(-dt * 18))
      tilt = {
        x: tilt.x + (tiltTarget.x - tilt.x) * k,
        y: tilt.y + (tiltTarget.y - tilt.y) * k,
      }
      t += dt * (calm ? 0.15 : 1)
      angle += dt * now.spin * (calm ? 0.1 : 1)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const R = Math.min(w * 0.34, h * 0.3)
      const cx = w / 2
      const cy = h * 0.45
      const focal = R * 3.2
      const baseY = cy + R * 1.55

      ctx.globalCompositeOperation = 'lighter'

      // Ambient glow behind the sphere.
      const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.9)
      halo.addColorStop(0, rgba(now.white, 0.1 * now.glow + voice * 0.08))
      halo.addColorStop(1, rgba(0, 0))
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, w, h)

      // Projector: light cone from the base up to the sphere, and the emitter disc.
      const cone = ctx.createLinearGradient(0, baseY, 0, cy - R * 0.2)
      cone.addColorStop(0, rgba(now.white, 0.16 * now.glow))
      cone.addColorStop(1, rgba(0, 0))
      ctx.fillStyle = cone
      ctx.beginPath()
      ctx.moveTo(cx - R * 0.28, baseY)
      ctx.lineTo(cx - R * 1.05, cy)
      ctx.lineTo(cx + R * 1.05, cy)
      ctx.lineTo(cx + R * 0.28, baseY)
      ctx.closePath()
      ctx.fill()
      for (let i = 0; i < 3; i++) {
        const pulse = calm ? 0 : (t * 0.6 + i / 3) % 1
        ctx.strokeStyle = rgba(now.white, (0.5 - i * 0.12) * (1 - pulse * 0.8))
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(cx, baseY, R * (0.32 + i * 0.16 + pulse * 0.12), R * (0.06 + i * 0.03 + pulse * 0.02), 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      const cosA = Math.cos(angle + tilt.y)
      const sinA = Math.sin(angle + tilt.y)
      const tiltX = -0.32 + tilt.x
      const cosB = Math.cos(tiltX)
      const sinB = Math.sin(tiltX)
      // Rotate around Y, then tilt around X, then project with a little perspective.
      const project = (x: number, y: number, z: number) => {
        const x1 = x * cosA + z * sinA
        const z1 = -x * sinA + z * cosA
        const y1 = y * cosB - z1 * sinB
        const z2 = y * sinB + z1 * cosB
        const s = focal / (focal + z2)
        return { x: cx + x1 * s, y: cy + y1 * s, z: z2, s }
      }

      // Orbit rings with a light travelling along each.
      const rings = [
        { r: 1.32, tx: 1.25, tz: 0.2, speed: 0.9 },
        { r: 1.48, tx: 1.45, tz: -0.55, speed: -0.6 },
        { r: 1.64, tx: 1.1, tz: 0.9, speed: 0.4 },
      ]
      for (const ring of rings) {
        const ct = Math.cos(ring.tx)
        const st = Math.sin(ring.tx)
        const cz = Math.cos(ring.tz)
        const sz = Math.sin(ring.tz)
        const head = (t * ring.speed * (1 + now.ripple * 2)) % (Math.PI * 2)
        const steps = 120
        let prev: ReturnType<typeof project> | null = null
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2
          const px = Math.cos(a) * R * ring.r
          const pz = Math.sin(a) * R * ring.r
          const y0 = -pz * st
          const z0 = pz * ct
          const p = project(px * cz - y0 * sz, px * sz + y0 * cz, z0)
          if (prev) {
            const depth = 0.5 - p.z / (R * ring.r * 2)
            const gap = Math.abs(((a - head + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
            const lit = Math.max(0, 1 - gap / 0.6)
            ctx.strokeStyle = rgba(now.white + lit * 0.5, (0.14 + depth * 0.26) * now.glow + lit * 0.6)
            ctx.lineWidth = 1 + lit * 1.5
            ctx.beginPath()
            ctx.moveTo(prev.x, prev.y)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
          }
          prev = p
        }
      }

      // The sphere: each point pushed out by slow surface waves, thinking ripples and the voice.
      for (const pt of points) {
        let d = now.amp * Math.sin(pt.lat * 3 + t * 1.6) * Math.cos(pt.lon * 2 - t * 1.1)
        d += now.ripple * 0.06 * Math.sin(pt.lat * 9 - t * 7)
        d += voice * 0.2 * (0.5 + 0.5 * Math.sin(pt.x * 7 + t * 9) * Math.sin(pt.y * 6 - t * 6.5))
        const r = R * (1 + d)
        const p = project(pt.x * r, pt.y * r, pt.z * r)
        const front = 0.5 - p.z / (R * 2.4)
        const size = (0.8 + front * 1.6) * p.s
        ctx.fillStyle = rgba(now.white + front * 0.25, Math.min(1, (0.16 + front * 0.84) * (0.7 + now.glow * 0.5)))
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size)
      }

      // Core: a soft light inside that swells with the voice.
      const coreR = R * (0.42 + voice * 0.25 + now.ripple * 0.05 * Math.sin(t * 6))
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      core.addColorStop(0, rgba(now.white + 0.4, 0.35 * now.glow + voice * 0.3))
      core.addColorStop(1, rgba(0, 0))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fill()

      // Scan band sweeping down through the hologram.
      if (!calm) {
        const sweep = ((t * 0.35) % 1) * (baseY - (cy - R * 1.3)) + (cy - R * 1.3)
        const band = ctx.createLinearGradient(0, sweep - 18, 0, sweep + 18)
        band.addColorStop(0, rgba(0, 0))
        band.addColorStop(0.5, rgba(now.white, 0.07))
        band.addColorStop(1, rgba(0, 0))
        ctx.fillStyle = band
        ctx.fillRect(cx - R * 1.8, sweep - 18, R * 3.6, 36)
      }

      ctx.globalCompositeOperation = 'source-over'
      frame = requestAnimationFrame(draw)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      last = performance.now()
      frame = requestAnimationFrame(draw)
    }
    // No drawing while the tab is hidden.
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start())
    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [level])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
