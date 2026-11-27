import { expect, test, type Page } from '@playwright/test'
import { open, watchErrors } from './helpers'

// T2 of the motion storyboard (docs/motion-storyboard.md section 4): page transitions. Chromium runs real view
// transitions; the hook below records what the browser is about to animate when each one is ready.
const desktop = { width: 1440, height: 900 }

type Rec = { at: string; nav: string | null; out: string; in: string; pin: string; pout: string; fira: string; header: string }

// Wraps document.startViewTransition before the page scripts run and keeps one record per transition.
async function hook(page: Page) {
  await page.addInitScript(() => {
    const orig = document.startViewTransition?.bind(document)
    if (!orig) return
    const w = window as unknown as { __vt: unknown[] }
    w.__vt = []
    document.startViewTransition = ((arg: unknown) => {
      const t = orig(arg as never)
      void t.ready
        .then(() => {
          const r = document.documentElement
          const cs = (p: string) => getComputedStyle(r, p)
          w.__vt.push({
            at: location.pathname,
            nav: r.dataset.nav ?? null,
            out: `${cs('::view-transition-old(root)').animationName}/${cs('::view-transition-old(root)').animationDuration}`,
            in: `${cs('::view-transition-new(root)').animationName}/${cs('::view-transition-new(root)').animationDuration}`,
            pin: cs('::view-transition-new(root)').getPropertyValue('--pt-in').trim(),
            pout: cs('::view-transition-old(root)').getPropertyValue('--pt-out').trim(),
            fira: cs('::view-transition-group(fira)').animationName,
            header: cs('::view-transition-group(pt-header)').animationName,
          })
        })
        .catch(() => {})
      return t
    }) as typeof document.startViewTransition
  })
}

const records = (page: Page) => page.evaluate(() => (window as unknown as { __vt?: Rec[] }).__vt ?? [])
// The record of the transition into `path` (a Suspense reveal on the way in may add an earlier one without a direction).
async function lastRecord(page: Page, path?: string): Promise<Rec> {
  await expect.poll(async () => (await records(page)).filter((r) => !path || r.at === path).length, { timeout: 15_000 }).toBeGreaterThan(0)
  return (await records(page)).filter((r) => !path || r.at === path).at(-1) as Rec
}
async function settle(page: Page, url: RegExp) {
  await page.waitForURL(url, { timeout: 20_000 })
  await page.waitForTimeout(700)
}

test.describe('page transitions (Chromium)', () => {
  test.use({ viewport: desktop })

  test('forward slides the page, the chrome stays put, nothing errors, the content is there after 600 ms', async ({ page }) => {
    const errors = watchErrors(page)
    await hook(page)
    await open(page, '/ru')
    await page.locator('header a[href="/ru/how-we-work"]').first().click()
    const rec = await lastRecord(page, '/ru/how-we-work')
    expect(rec.nav).toBe('forward')
    expect(rec.out).toBe('pt-out/0.16s')
    expect(rec.in).toBe('pt-in/0.26s')
    expect(rec.pout).toBe('-12px')
    expect(rec.pin).toBe('16px')
    expect(rec.header, 'the header group does not animate').toBe('none')
    await settle(page, /\/ru\/how-we-work$/)
    await expect(page.locator('main h1').first()).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('going up the map mirrors the slide (back direction)', async ({ page }) => {
    await hook(page)
    await open(page, '/ru/products/admin')
    await page.locator('header a[href="/ru/how-we-work"]').first().click()
    const rec = await lastRecord(page, '/ru/how-we-work')
    expect(rec.nav).toBe('back')
    expect(rec.pout).toBe('12px')
    expect(rec.pin).toBe('-16px')
  })

  test('the browser Back button swaps at once, restores the scroll position and logs nothing', async ({ page }) => {
    const errors = watchErrors(page)
    await hook(page)
    await open(page, '/ru/how-we-work')
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
    await page.waitForTimeout(300)
    const y = await page.evaluate(() => Math.round(window.scrollY))
    expect(y).toBeGreaterThan(500)
    await page.evaluate(() => document.querySelector<HTMLAnchorElement>('footer a[href="/ru/terms"]')?.click())
    await settle(page, /\/ru\/terms$/)
    await page.goBack()
    await settle(page, /\/ru\/how-we-work$/)
    await expect(page.locator('main h1').first()).toBeVisible()
    const after = await page.evaluate(() => Math.round(window.scrollY))
    expect(Math.abs(after - y), `scroll ${y} restored to ${after}`).toBeLessThan(60)
    expect(errors).toEqual([])
  })

  test('Fira: the hero Fira is the shared element, the rail marker is excluded', async ({ page }) => {
    await hook(page)
    await open(page, '/ru')
    await page.locator('a[href="/ru/products/admin"]').first().evaluate((el) => (el as HTMLAnchorElement).click())
    const rec = await lastRecord(page, '/ru/products/admin')
    expect(rec.fira, 'the hero Fira morphs into the launcher face').toBe('-ua-view-transition-group-anim-fira')
    await settle(page, /\/products\/admin$/)
    const marker = await page.evaluate(() => [...document.querySelectorAll('.rail-fira, [data-progress-fira]')].map((e) => getComputedStyle(e).viewTransitionName))
    expect(marker.length).toBeGreaterThan(0)
    expect(marker.every((n) => n === 'none')).toBe(true)
  })

  test('the legal pages fade: no slide and no Fira morph', async ({ page }) => {
    await hook(page)
    await open(page, '/ru')
    await page.locator('footer a[href="/ru/terms"]').first().click()
    const rec = await lastRecord(page, '/ru/terms')
    expect(rec.nav).toBe('fade')
    expect(rec.pin).toBe('0px')
    expect(rec.pout).toBe('0px')
    expect(rec.fira).toBe('none')
  })

  test('the language switch is a crossfade', async ({ page }) => {
    const errors = watchErrors(page)
    await hook(page)
    await open(page, '/ru/how-we-work')
    await page.locator('header a[hreflang="en"]').first().click()
    const rec = await lastRecord(page, '/en/how-we-work')
    expect(rec.pin).toBe('0px')
    expect(rec.pout).toBe('0px')
    expect(rec.in).toMatch(/^pt-in\//)
    await settle(page, /\/en\/how-we-work$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    expect(errors).toEqual([])
  })

  test('the film Fira fades at the start of the navigation', async ({ page }) => {
    await hook(page)
    await open(page, '/ru')
    await page.locator('.film-fira').waitFor({ state: 'attached', timeout: 15_000 })
    await page.evaluate(() => {
      const w = window as unknown as { __leaving: boolean }
      w.__leaving = false
      new MutationObserver((list) => {
        for (const m of list) if ((m.target as HTMLElement).dataset?.leaving === 'true') w.__leaving = true
      }).observe(document.body, { attributes: true, attributeFilter: ['data-leaving'], subtree: true })
    })
    await page.locator('header a[href="/ru/how-we-work"]').first().click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __leaving: boolean }).__leaving)).toBe(true)
  })
})

test.describe('reduced motion and unsupported browsers', () => {
  test.use({ viewport: desktop })

  test('reduced motion: a 150 ms fade, no slide class in effect, no morph', async ({ browser }) => {
    const context = await browser.newContext({ viewport: desktop, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await hook(page)
    await open(page, '/ru')
    await page.locator('header a[href="/ru/how-we-work"]').first().click()
    const rec = await lastRecord(page, '/ru/how-we-work')
    expect(rec.in).toBe('pt-fade-in/0.15s')
    expect(rec.out).toMatch(/^none\//)
    expect(rec.pin).toBe('0px')
    expect(rec.pout).toBe('0px')
    expect(rec.fira).toBe('none')
    await context.close()
  })

  test('a browser without view transitions navigates instantly and quietly', async ({ page }) => {
    const errors = watchErrors(page)
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'startViewTransition', { value: undefined, configurable: true })
    })
    await open(page, '/ru')
    await page.locator('header a[href="/ru/how-we-work"]').first().click()
    await settle(page, /\/ru\/how-we-work$/)
    await expect(page.locator('main h1').first()).toBeVisible()
    await page.locator('header a[href="/ru"]').first().click()
    await settle(page, /\/ru$/)
    expect(errors).toEqual([])
  })
})
