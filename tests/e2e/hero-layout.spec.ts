import { expect, test } from '@playwright/test'

// Audit 2026-11-22: on 1440x900 the guarantee line and the scroll hint ran under the front product card.
const sizes = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
]

for (const size of sizes) {
  test(`hero bottom row does not overlap the product card ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/ru')
    await page.waitForTimeout(1500)
    const boxes = await page.evaluate(() => {
      const r = (el: Element | null | undefined) => {
        const b = el?.getBoundingClientRect()
        return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom } : null
      }
      const card = [...document.querySelectorAll<HTMLElement>('.hero-card')].find((e) => e.dataset.active === 'true')
      return {
        card: r(card),
        cue: r(document.querySelector('[data-hero-cue] [data-film-line]')),
        parts: ['[data-hero-promises]', '[data-hero-rail] > div'].map((s) => r(document.querySelector(s))),
      }
    })
    expect(boxes.card).not.toBeNull()
    // Fira's greeting stays on the first screen at every height (owner), inside the viewport and clear of the card.
    expect(boxes.cue).not.toBeNull()
    expect(boxes.cue!.t).toBeGreaterThanOrEqual(0)
    expect(boxes.cue!.b).toBeLessThanOrEqual(size.height)
    expect(boxes.cue!.r <= boxes.card!.l || boxes.cue!.b <= boxes.card!.t).toBe(true)
    // the guarantee and the response lines end above the dots row and inside the screen
    expect(boxes.parts[0]!.b).toBeLessThanOrEqual(boxes.parts[1]!.t)
    expect(boxes.parts[0]!.b).toBeLessThanOrEqual(size.height)
    for (const p of boxes.parts) {
      expect(p).not.toBeNull()
      const c = boxes.card!
      const hit = p!.l < c.r && p!.r > c.l && p!.t < c.b && p!.b > c.t
      expect(hit).toBe(false)
    }
  })
}

// Audit 2026-11-22: the floating chat launcher sat on the right edge of the front product card.
for (const size of [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`chat launcher does not overlap the product card ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/ru')
    await page.waitForTimeout(1500)
    const boxes = await page.evaluate(() => {
      const r = (el: Element | null | undefined) => {
        const b = el?.getBoundingClientRect()
        return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom } : null
      }
      const card = [...document.querySelectorAll<HTMLElement>('.hero-card')].find((e) => e.dataset.active === 'true')
      return { card: r(card), fab: r(document.querySelector('[data-cta="chat_fab"]')) }
    })
    expect(boxes.card).not.toBeNull()
    expect(boxes.fab).not.toBeNull()
    const { card: c, fab: f } = boxes
    const hit = f!.l < c!.r && f!.r > c!.l && f!.t < c!.b && f!.b > c!.t
    expect(hit, JSON.stringify(boxes)).toBe(false)
  })
}
