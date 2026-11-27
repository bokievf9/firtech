import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, SIZES, watchErrors } from './helpers'

// Scene templates (T3, docs/motion-storyboard.md 5.1): the text of every wired page is in the server HTML, reduced
// motion shows plain visible content, the pin exists only on wide screens, no horizontal scroll, no layout shift.
const routes = ['/ru', '/ru/products/company', '/ru/products/receptionist', '/ru/products/admin', '/ru/how-we-work', '/ru/compare', '/ru/referral', '/ru/services/websites', '/ru/ai-team', '/ru/solutions/salon']

test.describe('server HTML', () => {
  for (const route of routes.slice(1)) {
    test(`${route}: the h1 words are real text in the HTML and every scene child is in the markup`, async ({ request }) => {
      const res = await request.get(route)
      expect(res.status()).toBe(200)
      const html = await res.text()
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
      expect(h1, 'h1 in server HTML').toBeTruthy()
      const inner = h1?.[1] ?? ''
      const text = inner.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim()
      expect(text.length).toBeGreaterThan(8)
      if (inner.includes('scene-w')) expect((inner.match(/class="scene-w"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    })
  }
})

test.describe('reduced motion: plain stacked content', () => {
  test.use({ reducedMotion: 'reduce' })
  for (const [name, size] of Object.entries(SIZES)) {
    for (const route of routes) {
      test(`${route} at ${name}: nothing is hidden, no overflow`, async ({ page }) => {
        await page.setViewportSize(size)
        const errors = watchErrors(page, [/Failed to load resource/, /WebGL/i, /favicon/])
        await page.goto(route)
        await page.waitForLoadState('load')
        const hidden = await page.evaluate(() => {
          const bad: string[] = []
          const check = (el: Element, why: string) => {
            const cs = getComputedStyle(el)
            if (Number(cs.opacity) < 0.99) bad.push(`${why} opacity ${cs.opacity}`)
            if (cs.clipPath !== 'none') bad.push(`${why} clip-path ${cs.clipPath}`)
            if (cs.animationName !== 'none' && cs.animationName.startsWith('scene-')) bad.push(`${why} animates ${cs.animationName}`)
          }
          document.querySelectorAll('.scene-stack > *, .scene-chat > *, .scene-wipe, .scene-w, .scene-pin-stage > *').forEach((el) => check(el, el.className.toString().slice(0, 40) || el.tagName))
          return bad
        })
        expect(hidden).toEqual([])
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('.scene-pin-stage') ?? document.body).position)).not.toBe('sticky')
        await noHorizontalOverflow(page, route)
        expect(errors).toEqual([])
      })
    }
  }
})

test.describe('motion on: groups play once, pin only on wide screens, no layout shift', () => {
  test('card stack and wipe settle after scrolling into view; the home page does not shift', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/ru/compare')
    await page.waitForLoadState('load')
    const row = page.locator('#contrast li.scene-wipe-row').first()
    await row.scrollIntoViewIfNeeded()
    await expect(row).toHaveAttribute('data-scene', /on|done/)
    await expect(page.locator('.scene-wipe').first()).toBeVisible()
    await page.goto('/ru/products/admin')
    await page.locator('#capabilities').scrollIntoViewIfNeeded()
    await expect(page.locator('#capabilities .scene-stack')).toHaveAttribute('data-scene', /on|done/)
    const cards = page.locator('#capabilities .scene-stack > *')
    await expect(cards.last()).toHaveCSS('opacity', '1', { timeout: 5000 })
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls).toBeLessThan(0.02)
  })

  test('the flow steps pin on lg+ and stay a plain list on phones', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await page.goto('/ru/products/receptionist')
    const track = page.locator('.scene-pin').first()
    await expect(track).toBeVisible()
    const h = await track.evaluate((el) => el.getBoundingClientRect().height)
    expect(h).toBeGreaterThan(900)
    await expect(page.locator('.scene-pin-stage').first()).toHaveCSS('position', 'sticky')
    await track.scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 700)
    await expect.poll(async () => page.locator('.scene-pin-stage > [data-on]').count(), { timeout: 5000 }).toBeGreaterThan(0)
    await page.setViewportSize(SIZES.mobile)
    await expect(page.locator('.scene-pin-stage').first()).not.toHaveCSS('position', 'sticky')
    await noHorizontalOverflow(page, 'receptionist phone')
  })

  test('the blueprint line is drawn: product day timeline carries a line and nodes', async ({ page }) => {
    await page.goto('/ru/products/admin')
    await expect(page.locator('[data-day-timeline] .scene-line-y')).toHaveCount(1)
    expect(await page.locator('[data-day-timeline] [data-node]').count()).toBeGreaterThanOrEqual(5)
    await expect(page.locator('[data-day-timeline] li').first()).toBeVisible()
  })
})
