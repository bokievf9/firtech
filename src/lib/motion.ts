import type { Transition } from 'motion/react'

// Motion tokens of design system v4 (docs/design-system-v4.md «Движение»). Apple's two spring knobs map
// onto Motion's `bounce` + `duration`: bounce 0 = damping ratio 1.0 (critically damped, no overshoot),
// duration = the perceived response in seconds. Springs start from the value on screen and keep their
// velocity when retargeted, so every animation here can be grabbed and reversed mid-flight.
// Under reduced motion use `fade` (MotionProvider already makes transforms instant).
export const spring = {
  // Default for UI: position, size, layout, the sliding tab and nav highlight. No overshoot.
  ui: { type: 'spring', bounce: 0, duration: 0.4 },
  // Small and fast: pressed states, toggles, chips, toasts.
  snappy: { type: 'spring', bounce: 0, duration: 0.28 },
  // Sheets, drawers, the chat panel: Apple ships damping 0.8 / response 0.3 for drawers.
  sheet: { type: 'spring', bounce: 0.12, duration: 0.42 },
  // Only after a gesture with momentum (a flick, a drag release): a little bounce is earned.
  momentum: { type: 'spring', bounce: 0.22, duration: 0.45 },
} as const satisfies Record<string, Transition>

// Opacity-only fallback for reduced motion and for exits of big surfaces.
export const fade = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const satisfies Transition

// Reveal on scroll (one time, sections and cards): short rise, strong ease-out, a stagger step.
export const reveal = { duration: 0.6, ease: [0.16, 1, 0.3, 1] } as const satisfies Transition
export const staggerStep = 0.05

// Materialize: glass surfaces arrive as a material (blur and scale together), not as a plain fade.
// Values for `initial` / `exit`; `animate` is { opacity: 1, scale: 1, filter: 'blur(0px)' }.
export const materialize = {
  hidden: { opacity: 0, scale: 0.97, filter: 'blur(6px)' },
  shown: { opacity: 1, scale: 1, filter: 'blur(0px)' },
} as const
