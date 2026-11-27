import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Wide screens (2026-11-27): container tiers, hero size, one-line nav, no horizontal scroll.
const sizes = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3440, height: 1440 },
]
const pages = [
  { path: '/ru', name: 'home' },
  { path: '/ru/ai-team/agent/lead-handler', name: 'agent' },
  { path: '/ru/builder', name: 'builder' },
  { path: '/ru/products/company', name: 'product' },
]
mkdirSync('.e2e-shots/wide', { recursive: true })

test.use({ reducedMotion: 'reduce' })
for (const p of pages) {
  for (const s of sizes) {
    test(`wide ${p.name} ${s.width}x${s.height}`, async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height })
      await page.goto(p.path)
      await page.waitForTimeout(1200)
      const m = await page.evaluate(() => {
        const rect = (el: Element | null) => (el ? el.getBoundingClientRect() : null)
        const c = [...document.querySelectorAll('.site-container')].map((e) => e.getBoundingClientRect().width)
        const links = [...document.querySelectorAll('header nav a')].filter((a) => a.getBoundingClientRect().width > 0)
        const hero = rect(document.querySelector('[data-hero]'))
        const stage = rect(document.querySelector('[data-hero-orbit]'))
        return {
          containerMax: c.length ? Math.max(...c) : 0,
          hero: hero ? hero.height : 0,
          stage: stage ? stage.width : 0,
          nav: links.map((a) => {
            // text block height of the label (without the link's padding) in font sizes
            const cs = getComputedStyle(a)
            const h = a.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
            return h / parseFloat(cs.fontSize)
          }),
          scrollW: document.documentElement.scrollWidth,
          rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
        }
      })
      console.log(`TIER ${p.name} ${s.width}: container ${m.containerMax}px, hero ${Math.round(m.hero)}px, scene ${Math.round(m.stage)}px, root ${m.rootFont.toFixed(2)}px, nav max ${Math.max(0, ...m.nav).toFixed(2)}em`)
      if (m.containerMax) {
        const tier = s.width >= 2400 ? 1840 : s.width >= 1920 ? 1680 : s.width >= 1536 ? 1440 : null
        if (tier) expect(Math.abs(m.containerMax - tier)).toBeLessThanOrEqual(2)
        else expect(m.containerMax).toBeLessThanOrEqual(s.width + 2)
      }
      for (const r of m.nav) expect(r).toBeLessThanOrEqual(1.6)
      expect(m.scrollW).toBeLessThanOrEqual(s.width)
      if (p.name === 'home') {
        expect(m.hero).toBeGreaterThanOrEqual(s.height - 1)
      }
      await page.screenshot({ path: `.e2e-shots/wide/${p.name}-${s.width}.png` })
    })
  }
}

test('hero scene grows between 1920 and 2560', async ({ browser }) => {
  const w: number[] = []
  for (const { width, height } of [{ width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    const pg = await ctx.newPage()
    await pg.goto('/ru')
    await pg.waitForTimeout(1000)
    w.push(await pg.evaluate(() => document.querySelector('[data-hero-orbit]')!.getBoundingClientRect().width))
    await ctx.close()
  }
  console.log(`TIER scene 1920=${Math.round(w[0] ?? 0)} 2560=${Math.round(w[1] ?? 0)}`)
  expect(w[1] ?? 0).toBeGreaterThan((w[0] ?? 0) + 20)
})

test('tier boundaries do not jump the page (+-1px)', async ({ page }) => {
  for (const width of [1535, 1536, 1919, 1920, 2399, 2400]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/ru')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(sw, String(width)).toBeLessThanOrEqual(width)
  }
})
