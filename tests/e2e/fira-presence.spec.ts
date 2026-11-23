import { expect, test } from '@playwright/test'
import { fakeSessionCookie, open, SIZES, watchErrors } from './helpers'

// Fira live 1.1 (F2): she is on every page (the builder, the cabinet, the legal pages, the blog, the 404), a click opens
// the chat, and at 390 she never sits on the builder's sticky bar.
const pages = ['/ru', '/ru/builder', '/ru/terms', '/ru/privacy', '/ru/blog', '/ru/no-such-page-zz']

for (const url of pages) {
  test(`fira presence: the launcher is on ${url}`, async ({ page }) => {
    const errors = watchErrors(page, [/Failed to load resource/])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, url)
    await expect(page.locator('[data-cta=chat_fab]')).toBeVisible()
    await expect(page.locator('[data-cta=chat_fab] [data-fira-stage]')).toHaveCount(1)
    expect(errors).toEqual([])
  })
}

test('fira presence: the launcher is on the cabinet (signed in)', async ({ page, context, baseURL }) => {
  await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/cabinet')
  await expect(page.locator('[data-cta=chat_fab]')).toBeVisible()
})

test('fira presence: her menu opens the chat, a click on a free stage dispatches open-chat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/terms')
  await page.locator('[data-cta=chat_fab]').click()
  await page.locator('[data-cta=fira_ask]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // the event path the stage uses everywhere else
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fira', { detail: { type: 'open-chat' } })))
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('fira presence: at 390 the launcher rides above the builder sticky bar', async ({ page }) => {
  await page.setViewportSize(SIZES.mobile)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/builder')
  const bar = page.locator('[data-fira-avoid]')
  await expect(bar).toBeVisible()
  const fab = page.locator('[data-cta=chat_fab]')
  await expect(fab).toBeVisible()
  await expect
    .poll(async () => {
      const [b, f] = await Promise.all([bar.boundingBox(), fab.boundingBox()])
      return b && f ? b.y - (f.y + f.height) : -99
    })
    .toBeGreaterThanOrEqual(0)
})

test('fira presence: the 404 points her at «home»', async ({ page }) => {
  await open(page, '/ru/no-such-page-zz')
  await expect(page.locator('[data-fira-target=home]')).toBeVisible()
  await expect(page.locator('[data-fira-stage]').first()).toHaveAttribute('data-fira-state', /point|sorry/, { timeout: 6000 })
})

// Walkthrough 2026-11-24: at 390 the home hero has one Fira bubble owner and the primary CTA is never covered.
for (const wait of [3000, 12500]) {
  test(`fira presence: at 390 the hero CTA is clickable after ${wait} ms and no second bubble covers it`, async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/ru')
    await page.waitForTimeout(wait)
    const cta = page.locator('[data-cta=hero_builder]').first()
    await expect(cta).toBeVisible()
    const covered = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1))
      return !(top && (top === el || el.contains(top)))
    })
    expect(covered).toBe(false)
    await expect(page.locator('[data-fira-bubble=line][data-open=true]')).toHaveCount(0)
  })
}
