// Geometry of the spotlight tour (Fira nav 2.0): the cutout around the anchor, where the bubble goes, how far to
// scroll. Pure functions, tested in tests/fira-nav.test.mjs; the component is components/fira/fira-spotlight.tsx.

export type Rect = { x: number; y: number; w: number; h: number }
export type Size = { w: number; h: number }

/** The soft cutout: the anchor plus 12 px on every side. */
export const SPOT_PAD = 12
export const SPOT_RADIUS = 20
/** Sticky header height the scroll leaves free. */
export const HEADER_OFFSET = 88
/** Room the bubble needs below a small anchor. */
export const BUBBLE_RESERVE = 220
const EDGE = 8

/** The anchor's box with padding, clipped to the viewport (a scene taller than the screen cuts out the screen). */
export function cutoutRect(el: Rect, vw: number, vh: number, pad = SPOT_PAD): Rect {
  const x0 = Math.max(EDGE, el.x - pad)
  const y0 = Math.max(EDGE, el.y - pad)
  const x1 = Math.min(vw - EDGE, el.x + el.w + pad)
  const y1 = Math.min(vh - EDGE, el.y + el.h + pad)
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

export type Side = 'bottom' | 'top' | 'right' | 'left' | 'inside' | 'sheet'
export const NARROW_MAX = 640

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/**
 * Where the bubble sits next to the cutout. Order: below, above, right, left (wide screens only), else inside the
 * cutout's lower corner. On a phone it is a full-width sheet at the bottom, or at the top when the cutout reaches
 * the bottom edge. `header` is the free band at the top of the screen.
 */
export function placeBubble(
  target: Rect, vw: number, vh: number, size: Size, opts: { gap?: number; margin?: number; header?: number } = {},
): { x: number; y: number; side: Side } {
  const gap = opts.gap ?? 16
  const m = opts.margin ?? 12
  const header = opts.header ?? 76
  if (vw < NARROW_MAX) {
    const sheetY = vh - size.h - m
    if (target.y + target.h <= sheetY - 8) return { x: m, y: sheetY, side: 'sheet' }
    if (target.y - 8 >= header + size.h + 8) return { x: m, y: header + 8, side: 'top' }
    return { x: m, y: sheetY, side: 'sheet' }
  }
  const cx = clamp(target.x + target.w / 2 - size.w / 2, m, vw - size.w - m)
  const cy = clamp(target.y + target.h / 2 - size.h / 2, header, vh - size.h - m)
  if (target.y + target.h + gap + size.h <= vh - m) return { x: cx, y: target.y + target.h + gap, side: 'bottom' }
  if (target.y - gap - size.h >= header) return { x: cx, y: target.y - gap - size.h, side: 'top' }
  if (target.x + target.w + gap + size.w <= vw - m) return { x: target.x + target.w + gap, y: cy, side: 'right' }
  if (target.x - gap - size.w >= m) return { x: target.x - gap - size.w, y: cy, side: 'left' }
  // No free side (the anchor fills the screen): the lower right corner inside it.
  const bottom = Math.min(target.y + target.h, vh - m)
  return { x: clamp(target.x + target.w - size.w - 16, m, vw - size.w - m), y: clamp(bottom - size.h - 16, header, vh - size.h - m), side: 'inside' }
}

/**
 * The scrollY that shows an anchor: a small one is centred with room kept below for the bubble, a tall one has its
 * top just under the header. `topDoc` is the anchor's top in the document, never below 0.
 */
export function scrollTopFor(topDoc: number, height: number, vh: number, header = HEADER_OFFSET, reserve = BUBBLE_RESERVE): number {
  const free = vh - header
  const offset = height + reserve <= free ? header + (free - height - reserve) / 2 : header
  return Math.max(0, Math.round(topDoc - offset))
}

export const TALL_SHARE = 0.7
/** A scene or section that is most of a screen: the spotlight takes its heading instead of the whole block. */
export const isTall = (height: number, vh: number) => height > vh * TALL_SHARE

/** A horizontal swipe on the bubble: -1 next (swipe left), 1 back (swipe right), 0 a tap or a vertical move. */
export function swipeDirection(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? -1 : 1
}

/** `k из N` for the progress line. */
export const progressLabel = (k: number, n: number, locale: string) => (locale === 'en' ? `${k} of ${n}` : `${k} из ${n}`)

/** The index after a step; a step past either end stays put. */
export const stepIndex = (i: number, n: number, dir: 1 | -1) => Math.min(Math.max(i + dir, 0), Math.max(0, n - 1))
