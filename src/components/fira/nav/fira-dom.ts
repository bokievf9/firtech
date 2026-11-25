import { SPOT_RADIUS, isTall, type Rect } from '@/lib/fira/nav/spotlight'

// Browser-only helpers of the guide: which element to light up, scrolling that waits to settle, the one-time pulse.

export const toRect = (r: DOMRect): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height })

/** The element the spotlight and the scroll aim at: a block taller than most of the screen gives its heading. */
export function focusOf(el: HTMLElement): HTMLElement {
  if (!isTall(el.getBoundingClientRect().height, window.innerHeight)) return el
  const head = el.querySelector<HTMLElement>('h1, h2, h3')
  return head && head.getBoundingClientRect().height > 0 ? head : el
}

/** The box of the focus: a heading is taken together with the paragraph that follows it. */
export function focusRect(el: HTMLElement): Rect {
  const focus = focusOf(el)
  const r = toRect(focus.getBoundingClientRect())
  if (focus === el) return r
  const next = focus.nextElementSibling
  if (next instanceof HTMLElement && next.tagName === 'P') {
    const n = next.getBoundingClientRect()
    if (n.height > 0) {
      const x0 = Math.min(r.x, n.left)
      const y0 = Math.min(r.y, n.top)
      return { x: x0, y: y0, w: Math.max(r.x + r.w, n.right) - x0, h: Math.max(r.y + r.h, n.bottom) - y0 }
    }
  }
  return r
}

/** Resolves when the element for one of the selectors exists (polls up to `ms`), else null. */
export function waitForElement(selectors: readonly string[], ms = 4000): Promise<HTMLElement | null> {
  const find = () => {
    for (const s of selectors) {
      const el = document.querySelector<HTMLElement>(s)
      if (el && (el.getBoundingClientRect().height > 0 || el.offsetParent !== null)) return el
    }
    return null
  }
  return new Promise((resolve) => {
    const first = find()
    if (first) return resolve(first)
    const t0 = Date.now()
    const id = window.setInterval(() => {
      const el = find()
      if (el || Date.now() - t0 > ms) {
        window.clearInterval(id)
        resolve(el)
      }
    }, 120)
  })
}

/** Resolves once the page stopped scrolling (position unchanged for 140 ms), at most `max` ms. */
export function scrollSettled(max = 1600): Promise<void> {
  return new Promise((resolve) => {
    let last = window.scrollY
    let still = 0
    const t0 = Date.now()
    const id = window.setInterval(() => {
      const y = window.scrollY
      still = Math.abs(y - last) < 1 ? still + 40 : 0
      last = y
      if (still >= 140 || Date.now() - t0 > max) {
        window.clearInterval(id)
        resolve()
      }
    }, 40)
  })
}

/** The one-time spotlight pulse on an element: a lime ring that breathes twice (a still ring under reduced motion). */
export function pulseElement(el: HTMLElement, reduce: boolean): void {
  document.querySelectorAll('[data-fira-pulse]').forEach((n) => n.remove())
  const r = focusRect(el)
  const pad = 10
  const ring = document.createElement('div')
  ring.setAttribute('data-fira-pulse', '')
  ring.setAttribute('aria-hidden', 'true')
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${r.x - pad}px`,
    top: `${r.y - pad}px`,
    width: `${r.w + pad * 2}px`,
    height: `${r.h + pad * 2}px`,
    borderRadius: `${SPOT_RADIUS}px`,
    pointerEvents: 'none',
    zIndex: '60',
    border: '2px solid var(--color-accent-text, #4d7c0f)',
    boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-accent, #c6ff3d) 55%, transparent)',
  })
  document.body.appendChild(ring)
  const done = () => ring.remove()
  if (reduce || typeof ring.animate !== 'function') {
    window.setTimeout(done, 1400)
    return
  }
  const anim = ring.animate(
    [
      { opacity: 0, transform: 'scale(1.04)', boxShadow: '0 0 0 0 color-mix(in srgb, var(--color-accent, #c6ff3d) 70%, transparent)' },
      { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 0 14px color-mix(in srgb, var(--color-accent, #c6ff3d) 0%, transparent)', offset: 0.5 },
      { opacity: 1, transform: 'scale(1.015)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-accent, #c6ff3d) 45%, transparent)' },
      { opacity: 0, transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' },
    ],
    { duration: 1500, easing: 'ease-out' },
  )
  anim.onfinish = done
  anim.oncancel = done
  window.setTimeout(done, 2200)
}
