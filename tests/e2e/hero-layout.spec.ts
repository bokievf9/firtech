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
        parts: ['[data-hero-promises]', '[data-hero-rail] > div'].map((s) => r(document.querySelector(s))),
      }
    })
    expect(boxes.card).not.toBeNull()
    for (const p of boxes.parts) {
      expect(p).not.toBeNull()
      const c = boxes.card!
      const hit = p!.l < c.r && p!.r > c.l && p!.t < c.b && p!.b > c.t
      expect(hit).toBe(false)
    }
  })
}
