import { expect, test } from '@playwright/test'

// Home hero (owner 2026-11-26): the 3D Fira in the centre, the seven products on an inclined ring.
const desktop = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

// Layout checks run with reduced motion: the ring stands still and no WebGL is started, so a loaded CI
// machine does not stall the compositor; the animated state is covered by the pause test below.
test.describe('static ring', () => {
test.use({ reducedMotion: 'reduce' })
for (const size of desktop) {
  test(`hero fills the viewport and shows seven product links ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/ru')
    await page.waitForTimeout(1500)
    const hero = await page.evaluate(() => document.querySelector('[data-hero]')!.getBoundingClientRect().height)
    expect(hero).toBeGreaterThanOrEqual(size.height - 1)
    const cards = page.locator('[data-orbit-card]')
    await expect(cards).toHaveCount(7)
    for (let i = 0; i < 7; i++) expect(await cards.nth(i).getAttribute('href')).toMatch(/^\/ru\/products\/[a-z-]+$/)
    await expect(page.locator('[data-hero-facts] li').first()).toBeVisible()
    // the stage is inside the first screen
    const r = async (sel: string) => page.evaluate((s) => {
      const b = document.querySelector(s)?.getBoundingClientRect()
      return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom } : null
    }, sel)
    const stage = await r('[data-hero-orbit]')
    expect(stage!.t).toBeGreaterThanOrEqual(0)
    expect(stage!.b).toBeLessThanOrEqual(size.height)
    // the chat launcher stays clear of the buttons
    const fab = await r('[data-cta="chat_fab"]')
    for (const sel of ['[data-cta="hero_builder"]', '[data-hero-facts]']) {
      const c = await r(sel)
      if (!fab || !c) continue
      expect(fab.l < c.r && fab.r > c.l && fab.t < c.b && fab.b > c.t, sel).toBe(false)
    }
  })
}
})

test('hover on a product pauses the ring and shows its benefit', async ({ page }) => {
  test.setTimeout(120_000) // the animated ring is heavy for a software-GL browser on a loaded machine
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/ru')
  await page.waitForTimeout(1200)
  const stage = page.locator('[data-hero-orbit]')
  await expect(stage).toHaveAttribute('data-paused', 'false')
  // focus is the reliable way to reach a card that is moving; hover uses the same handler
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-orbit-card]')!.focus())
  await expect(stage).toHaveAttribute('data-paused', 'true')
  await expect(page.locator('[data-orbit-caption]')).not.toBeEmpty()
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-orbit-card]')!.blur())
  await expect(stage).toHaveAttribute('data-paused', 'false')
})

test('phone: the products are a scrollable row, no horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ru')
  await page.waitForTimeout(1200)
  await expect(page.locator('[data-orbit-card]')).toHaveCount(7)
  const m = await page.evaluate(() => {
    const ring = document.querySelector<HTMLElement>('.orbit-ring')!
    return { scrolls: ring.scrollWidth > ring.clientWidth, page: document.documentElement.scrollWidth <= window.innerWidth }
  })
  expect(m.scrolls).toBe(true)
  expect(m.page).toBe(true)
})
