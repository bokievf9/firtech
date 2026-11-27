import { expect, test, type Page } from '@playwright/test'
import { open, watchErrors } from './helpers'

// T4 of the motion storyboard: the cold open (first visit only, at most 2 s, any input skips it) and the sound rules.
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })

const overlay = (page: Page) => page.locator('[data-cold-open]')

// Counts AudioContexts and oscillators the page creates, so "no audio before a gesture / off by default" is testable.
async function spyAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ac: number; __osc: number; AudioContext: typeof AudioContext }
    w.__ac = 0
    w.__osc = 0
    const Real = w.AudioContext
    if (!Real) return
    const create = Real.prototype.createOscillator
    Real.prototype.createOscillator = function (this: AudioContext) {
      w.__osc++
      return create.call(this)
    }
    w.AudioContext = class extends Real {
      constructor(o?: AudioContextOptions) {
        super(o)
        w.__ac++
      }
    }
  })
}
const audio = (page: Page) => page.evaluate(() => ({ ac: (window as unknown as { __ac: number }).__ac, osc: (window as unknown as { __osc: number }).__osc }))

test('first visit shows the overlay, the h1 is already in the HTML, and it is gone by 2 s; the second visit has none', async ({ page, request }) => {
  const errors = watchErrors(page)
  const html = await (await request.get('/ru')).text()
  expect(html).toMatch(/<h1[\s\S]*?<\/h1>/)
  expect(html).toContain('data-cold-open')
  expect(html).toContain('fir-open-seen')
  await page.goto('/ru', { waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-cold', 'on')
  await expect(overlay(page)).toBeVisible()
  await expect(page.locator('h1').first()).toBeAttached()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cold ?? ''), { timeout: 6000 }).toBe('')
  await expect(overlay(page)).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('fir-open-seen'))).toBe('1')
  await open(page, '/ru')
  await expect(page.locator('html')).not.toHaveAttribute('data-cold', /.+/)
  await page.reload()
  await expect(overlay(page)).toBeHidden()
  expect(errors).toEqual([])
})

test('a click skips the cold open at once', async ({ page }) => {
  await page.goto('/ru', { waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-cold', 'on')
  // The skip listeners attach on hydration (slow under load): input is repeated until they are there.
  await expect(async () => {
    await page.mouse.click(700, 400)
    await expect(overlay(page)).toBeHidden({ timeout: 700 })
  }).toPass({ timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cold ?? '')).toBe('')
})

test('a key press skips it too', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-cold', 'on')
  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(overlay(page)).toBeHidden({ timeout: 700 })
  }).toPass({ timeout: 15_000 })
})

test('no cold open for a hash URL, other pages, or when storage is blocked', async ({ page }) => {
  await page.goto('/ru#demo', { waitUntil: 'load' })
  await expect(page.locator('html')).not.toHaveAttribute('data-cold', /.+/)
  await page.goto('/ru/how-we-work', { waitUntil: 'load' })
  await expect(page.locator('html')).not.toHaveAttribute('data-cold', /.+/)
})

test.describe('reduced motion and Save-Data', () => {
  test('reduced motion: never', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/ru', { waitUntil: 'load' })
    await expect(page.locator('html')).not.toHaveAttribute('data-cold', /.+/)
    await expect(overlay(page)).toBeHidden()
  })
  test('Save-Data: never', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }))
    await page.goto('/ru', { waitUntil: 'load' })
    await expect(page.locator('html')).not.toHaveAttribute('data-cold', /.+/)
  })
})

test.describe('sound', () => {
  test.use({ viewport: { width: 1600, height: 900 } })
  test.use({ storageState: { cookies: [], origins: [{ origin: 'http://localhost:3740', localStorage: [{ name: 'fir-open-seen', value: '1' }] }] } })

  test('off by default: no AudioContext, no sound file, even after clicks and a CTA press', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await spyAudio(page)
    await open(page, '/ru')
    await page.mouse.click(700, 500)
    await page.locator('[data-cta]').first().click({ trial: true }).catch(() => {})
    await page.keyboard.press('Control+k')
    await page.keyboard.press('Escape')
    expect(await audio(page)).toEqual({ ac: 0, osc: 0 })
    expect(requests.filter((u) => /\/sound\//.test(u))).toEqual([])
  })

  test('turning it on plays the "on" cue after the gesture; a CTA press plays a cue; /pay and /cabinet stay silent', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await spyAudio(page)
    await open(page, '/ru')
    expect((await audio(page)).osc).toBe(0)
    await page.locator('header [data-sound-toggle]').click()
    await expect.poll(async () => (await audio(page)).osc).toBeGreaterThanOrEqual(2) // two-note rise
    const afterOn = (await audio(page)).osc
    await page.locator('[data-cta]').first().dispatchEvent('pointerdown')
    await expect.poll(async () => (await audio(page)).osc).toBeGreaterThan(afterOn)
    expect(requests.filter((u) => /\/sound\//.test(u))).toEqual([])

    for (const path of ['/ru/pay/abc', '/ru/cabinet']) {
      await page.goto(path, { waitUntil: 'load' }).catch(() => {})
      await page.waitForTimeout(2500) // /cabinet redirects to the sign-in page
      const before = (await audio(page)).osc
      await page.mouse.click(300, 300)
      await page.evaluate(() => document.dispatchEvent(new Event('pointerdown', { bubbles: true })))
      await page.keyboard.press('Control+k')
      expect((await audio(page)).osc, path).toBe(before)
    }
  })

  test('a stored "on" plays nothing before the first gesture', async ({ page }) => {
    await spyAudio(page)
    await page.addInitScript(() => localStorage.setItem('fir-sound', 'on'))
    await open(page, '/ru')
    expect(await audio(page)).toEqual({ ac: 0, osc: 0 })
  })
})
