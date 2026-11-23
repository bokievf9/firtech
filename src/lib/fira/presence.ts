import type { Emotion } from './pose'
import type { FiraState } from './live'

// Pure rules of the live presence (components/fira/fira-stage.tsx), free of React so node tests cover them.

/** The contract maps states 1:1 to emotions. */
export const emotionOf = (s: FiraState): Emotion => s

/** What she plays: a one-off wave beats everything; a live state other than idle beats the page's own pose. */
export function pickEmotion(live: FiraState, base: Emotion, waving: boolean): Emotion {
  if (waving) return 'wave'
  return live === 'idle' ? base : emotionOf(live)
}

export type Gate3d = { reduced: boolean; narrow: boolean; lowEnd: boolean; disabled?: boolean; slow?: boolean; owns: boolean; seen: boolean; armed: boolean }
/** 3D only when idle-armed, on screen once, not reduced / mobile / low-end / slow, and she owns the page's one canvas. */
export const canUse3d = (g: Gate3d) => g.armed && g.seen && g.owns && !g.reduced && !g.narrow && !g.lowEnd && !g.disabled && !g.slow

export function isLowEnd(nav: { hardwareConcurrency?: number; deviceMemory?: number }): boolean {
  return (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)
}

// FPS guard: below `minFps` for `windowMs` in a row means the 3D is too heavy here, drop to the SVG for good.
export type FpsGuard = { push: (dt: number) => boolean; tripped: () => boolean }
export function createFpsGuard({ minFps = 30, windowMs = 3000, warmupMs = 1000 } = {}): FpsGuard {
  let warm = 0
  let acc = 0
  let frames = 0
  let trip = false
  return {
    push(dt) {
      if (trip) return true
      if (!(dt > 0)) return false
      if (dt > 0.5) {
        // tab was hidden or the machine slept: not a measurement
        acc = 0
        frames = 0
        return false
      }
      if (warm < warmupMs / 1000) {
        warm += dt
        return false
      }
      acc += dt
      frames++
      if (acc * 1000 >= windowMs) {
        if (frames / acc < minFps) trip = true
        acc = 0
        frames = 0
      }
      return trip
    },
    tripped: () => trip,
  }
}

/** Body yaw toward a point `dx` px to the right (+) or left (-) of her, clamped so she never turns her back. */
export const aimYaw = (dx: number, max = 0.7) => Math.max(-max, Math.min(max, dx / 600))

/** One peek per block per session. */
export const peekKey = (pathname: string, kind: string, index: number) => `fira-peek:${pathname}:${kind}:${index}`
export const REACT_KINDS = ['pricing', 'cta'] as const
export const isReactKind = (v: string | undefined): v is (typeof REACT_KINDS)[number] => (REACT_KINDS as readonly string[]).includes(v ?? '')
