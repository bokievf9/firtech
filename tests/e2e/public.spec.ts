import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, PUBLIC_PAGES, setTheme, SIZES, watchErrors, open } from './helpers'

// Every public page renders with no console errors and no horizontal overflow, at 390 and 1440,
// in both themes (ru for every combination, en for two of them to keep the run short).
const combos = [
  { locale: 'ru', size: 'desktop', theme: 'light' },
  { locale: 'ru', size: 'desktop', theme: 'dark' },
  { locale: 'ru', size: 'mobile', theme: 'light' },
  { locale: 'ru', size: 'mobile', theme: 'dark' },
  { locale: 'en', size: 'desktop', theme: 'light' },
  { locale: 'en', size: 'mobile', theme: 'dark' },
] as const

for (const path of PUBLIC_PAGES) {
  test(`renders clean in every size, theme and language: ${path || '/'}`, async ({ page }) => {
    test.setTimeout(120_000)
    // The unknown invoice number is a deliberate 404 of the payment API.
    const errors = watchErrors(page, [/status of 404/])
    for (const c of combos) {
      await page.setViewportSize(SIZES[c.size])
      await setTheme(page, c.theme)
      const response = await page.goto(`/${c.locale}${path}`, { waitUntil: 'load' })
      const where = `/${c.locale}${path} ${c.size} ${c.theme}`
      // The not-found invoice answers 404 on purpose (the page is the «not found» state).
      if (path.includes('FT-2026-999')) expect(response?.status(), where).toBe(404)
      else expect(response?.status(), where).toBeLessThan(400)
      await expect(page.locator('body'), where).toBeVisible()
      await expect(page.locator('html'), where).toHaveAttribute('data-theme', c.theme)
      await page.waitForTimeout(300)
      await noHorizontalOverflow(page, where)
    }
    expect(errors).toEqual([])
  })
}

test('unknown path gives the branded 404 with a search (ru, en and outside the locales)', async ({ page }) => {
  for (const path of ['/ru/no-such-page', '/en/no-such-page', '/no-such-page']) {
    const response = await open(page, path)
    expect(response?.status(), path).toBe(404)
    await expect(page.getByRole('searchbox').or(page.locator('input[type=search]')).first(), path).toBeVisible()
  }
})

test('404 search filters the page list', async ({ page }) => {
  await open(page, '/ru/no-such-page')
  const search = page.locator('input[type=search]').first()
  await search.fill('конструктор')
  await expect(page.locator('main a[href="/ru/builder"]').first()).toBeVisible()
  await search.fill('qqqzzz')
  await expect(page.locator('main a[href="/ru/builder"]')).toHaveCount(0)
})

for (const locale of ['ru', 'en']) {
  test(`every header and footer link resolves 200 (${locale})`, async ({ page, request }) => {
    await open(page, `/${locale}`)
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('header a[href], footer a[href]')].map((a) => a.getAttribute('href')!),
    )
    const internal = [...new Set(hrefs.filter((h) => h.startsWith('/')).map((h) => h.split('#')[0] || '/'))]
    expect(internal.length).toBeGreaterThan(10)
    for (let i = 0; i < internal.length; i += 6) {
      const batch = internal.slice(i, i + 6)
      const statuses = await Promise.all(batch.map(async (href) => (await request.get(href, { maxRedirects: 5 })).status()))
      batch.forEach((href, j) => expect(statuses[j], href).toBe(200))
    }
    const external = hrefs.filter((h) => /^https?:/.test(h))
    expect(external.some((h) => h.includes('t.me/'))).toBe(true)
    expect(external.some((h) => h.includes('instagram.com'))).toBe(true)
  })
}

test('machine files answer 200', async ({ request }) => {
  for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/rss.xml', '/api/health', '/api/prices', '/api/office/public', '/api/status']) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(200)
  }
})

test('theme switch flips the page and remembers the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await open(page, '/ru')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light')
  await page.locator('[data-theme-switch]').first().click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('fir-theme'))).toBe('dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
})

test('language switch goes to the same page in the other language', async ({ page }) => {
  await open(page, '/ru/services/bots')
  await page.locator('header a[href="/en/services/bots"]').first().click()
  await expect(page).toHaveURL(/\/en\/services\/bots$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('mobile menu opens and links to the builder', async ({ page }) => {
  await page.setViewportSize(SIZES.mobile)
  await open(page, '/ru')
  await page.getByRole('button', { name: 'Меню' }).click()
  await page.locator('a[href="/ru/builder"]:visible').first().click()
  await expect(page).toHaveURL(/\/ru\/builder/)
})

test('home: hero and bento calls to action lead where they say', async ({ page }) => {
  await open(page, '/ru')
  const builder = page.locator('#products a[href^="/ru/builder"]').first()
  await expect(builder).toBeVisible()
  await expect(page.locator('a[href="https://t.me/firtech_bot?start=demo_salon"]').first()).toBeAttached()
  await expect(page.locator('a[href="/ru/audit"]').first()).toBeAttached()
  await builder.click()
  await expect(page).toHaveURL(/\/ru\/builder/)
})

test('home: FAQ items open and close', async ({ page }) => {
  await open(page, '/ru#faq')
  const item = page.locator('#faq button[aria-expanded]').nth(1)
  await item.scrollIntoViewIfNeeded()
  await expect(item).toHaveAttribute('aria-expanded', 'false')
  await item.click()
  await expect(item).toHaveAttribute('aria-expanded', 'true')
  await item.click()
  await expect(item).toHaveAttribute('aria-expanded', 'false')
})

test('referral link generator builds a ?ref= link and copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, '/ru/referral')
  await page.locator('main input[type=text], main input:not([type])').first().fill('Ali Baba')
  await expect(page.locator('main').getByText(/\?ref=/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Скопировать ссылку' }).click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/\/ru\?ref=ali_baba$/)
})

test('status page shows the systems list from the dev mock', async ({ page }) => {
  await open(page, '/ru/status')
  await expect(page.locator('main')).toContainText(/сайт|Сайт/)
})

test('header and footer anchors on the home page point at sections that exist', async ({ page }) => {
  await open(page, '/ru')
  const anchors = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('header a[href^="/ru#"], footer a[href^="/ru#"], main a[href^="#"]')].map((a) => a.getAttribute('href')!.split('#')[1]!))].filter(Boolean),
  )
  expect(anchors.length).toBeGreaterThan(5)
  for (const id of anchors) await expect(page.locator(`[id="${id}"]`), `#${id}`).toHaveCount(1)
})
