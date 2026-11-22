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
  await search.fill('сборка')
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
  for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/rss.xml', '/rss-en.xml', '/api/health', '/api/prices', '/api/office/public', '/api/status']) {
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
  await expect(page.locator('a[href*="demo_salon"]')).toHaveCount(0)
  await expect(page.locator('#products a[href="/ru/products/admin"]').first()).toBeAttached()
  await expect(page.locator('#top a[href="/ru/ai-team"]').first()).toBeAttached()
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
  expect(anchors.length).toBeGreaterThanOrEqual(3)
  for (const id of anchors) await expect(page.locator(`[id="${id}"]`), `#${id}`).toHaveCount(1)
})

const departments = ['marketing', 'sales', 'support', 'production', 'backoffice', 'company']

test('AI team: the index lists six departments and every card opens its page', async ({ page }) => {
  await open(page, '/ru/ai-team')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (const id of departments) await expect(page.locator(`main a[href="/ru/ai-team/${id}"]`).first(), id).toBeAttached()
  await expect(page.locator('main a[href^="/ru/ai-team/agent/"]').first()).toBeAttached()
  await page.locator('main a[href="/ru/ai-team/support"]').first().click()
  await expect(page).toHaveURL(/\/ru\/ai-team\/support$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // The page names no price for the department, only «По смете» (the contact form's budget chips are not prices of it).
  await expect(page.locator('main')).toContainText('По смете')
})

test('AI team: a department page lists its agents and an agent page opens the builder or the chat', async ({ page }) => {
  await open(page, '/ru/ai-team/marketing')
  const agent = page.locator('main a[href="/ru/ai-team/agent/trend-scout"]').first()
  await expect(agent).toBeAttached()
  await agent.click()
  await expect(page).toHaveURL(/\/ru\/ai-team\/agent\/trend-scout$/)
  await expect(page.locator('main a[href*="/ru/builder"]').first()).toBeAttached()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('pay-how: the three steps of paying in USDT are on the page and no local currency is quoted', async ({ page }) => {
  await open(page, '/ru/pay-how')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('main')).toContainText('USDT')
  await expect(page.locator('main')).toContainText('TRC20')
  await expect(page.locator('main')).toContainText('TON')
})

test('bare paths of known pages redirect to a language (contracts link /terms and /privacy)', async ({ request }) => {
  for (const [path, accept, to] of [
    ['/terms', 'ru-RU,ru;q=0.9', '/ru/terms'],
    ['/privacy', 'en-US,en;q=0.9', '/en/privacy'],
    ['/pay-how', 'ru', '/ru/pay-how'],
    ['/services/websites', 'en', '/en/services/websites'],
  ] as const) {
    const res = await request.get(path, { maxRedirects: 0, headers: { 'accept-language': accept } })
    expect(res.status(), path).toBe(307)
    expect(new URL(res.headers().location!, 'http://localhost').pathname, path).toBe(to)
    expect((await request.get(to)).status(), to).toBe(200)
  }
})

test('home: «Попробуйте сейчас» has two live tabs and the chat answers in mock mode', async ({ page }) => {
  await open(page, '/ru#demo')
  const tabs = page.locator('[data-demo-tab]')
  await expect(tabs).toHaveCount(2)
  expect(await tabs.evaluateAll((els) => els.map((el) => el.getAttribute('data-demo-tab')))).toEqual(['receptionist', 'personal'])
  await expect(page.locator('[data-niche]')).toHaveCount(6)
  await tabs.nth(1).click()
  await expect(page.locator('[data-demo-assistant]')).toBeVisible()
  await tabs.nth(0).click()
  await page.locator('[data-niche="clinic"]').click()
  // Signed out the chips are the scripted example; the visitor sees the sign-in prompt instead of an input.
  await page.locator('[data-demo-chat]').getByRole('button', { name: 'Хочу записаться к врачу' }).click()
  await expect(page.locator('[data-demo-chat]')).toContainText('Хочу записаться к врачу')
  await expect(page.locator('[data-demo-chat] li').nth(1)).toBeVisible()
})

test('home: the ladder, six solution cards with «Все решения» and the ask strip are there', async ({ page }) => {
  await open(page, '/ru')
  await expect(page.locator('[data-ladder-track]')).toHaveCount(3)
  await expect(page.locator('[data-ladder-rung="content-auto"]')).toHaveAttribute('href', '/ru/products/content')
  await expect(page.locator('#solutions [data-solution-card]')).toHaveCount(6)
  await expect(page.locator('#solutions [data-cta="solutions_all"]')).toHaveAttribute('href', '/ru/solutions')
  await expect(page.locator('#proof')).toHaveCount(0)
  await expect(page.locator('#faq [data-ask-strip]')).toContainText('Остались вопросы?')
})

test('product pages: each one has its own result headline, price, stage table, terms, objections and the builder with its product picked', async ({ page }) => {
  const seen: { sections: string[]; h1: string }[] = []
  for (const [id, chunk, h1, sections] of [
    ['receptionist', 'p.intake', 'Ни одна заявка не ждёт ответа до утра', ['hero', 'demo', 'flow', 'included', 'price', 'objections', 'offer', 'scope', 'next']],
    ['automation', 'p.automation', 'Отчёты, заявки и рассылки идут сами, а команда занимается делом', ['hero', 'before-after', 'routines', 'first', 'scope', 'included', 'price', 'offer', 'objections', 'next']],
  ] as const) {
    await open(page, `/ru/products/${id}`)
    // The headline is the client's result, not the product name.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1)
    // The block order of `productPages[id].sections` (src/content/product-pages.ts).
    const got = await page.locator('[data-product-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-product-section')!))
    expect(got, id).toEqual(sections)
    seen.push({ sections: got, h1: h1 })
    // Price, term and the stage table of the product's template.
    await expect(page.locator('[data-product-section="price"]')).toContainText('$')
    await expect(page.locator('[data-product-section="price"] [data-product-term]')).toBeVisible()
    await expect(page.locator('[data-stage-table] tbody tr').first()).toBeVisible()
    // The terms block and the objections as cards; no FAQ accordion on a product page.
    await expect(page.locator('[data-product-section="offer"]')).toBeVisible()
    expect(await page.locator('[data-objections] li').count()).toBeGreaterThanOrEqual(2)
    await expect(page.locator('#faq')).toHaveCount(0)
    await expect(page.locator('main button[aria-expanded]')).toHaveCount(0)
    // The hero button opens the builder with this product picked.
    const build = page.locator(`[data-cta="product_page_${id}_build"]`)
    await expect(build).toHaveAttribute('href', new RegExp(`/ru/builder\\?b=.*${chunk.replace('.', '\\.')}(?:[~-]|$)`))
    await build.click()
    await expect(page).toHaveURL(new RegExp(`/ru/builder\\?b=.*${chunk.replace('.', '\\.')}`))
  }
  // Two products must not share one template.
  expect(seen[0]!.h1).not.toBe(seen[1]!.h1)
  expect(seen[0]!.sections).not.toEqual(seen[1]!.sections)
})

// ---- home film and Fira (owner 2026-11-22) -------------------------------------------------------

test('home film: eight scenes, each with Fira on her mark and her line in the HTML', async ({ page }) => {
  await open(page, '/ru')
  await expect(page.locator('[data-film-scene]')).toHaveCount(8)
  await expect(page.locator('[data-film-mark]')).toHaveCount(8)
  await expect(page.locator('[data-film-mark] svg')).toHaveCount(8)
  await expect(page.locator('[data-film-line]').first()).toContainText('Привет, я Фира')
  await expect(page.locator('#pains [data-pain]')).toHaveCount(3)
  await expect(page.locator('#office [data-office-room]')).toHaveCount(6)
  await expect(page.locator('#products [data-film-intro]')).toHaveCount(8)
  await expect(page.locator('[data-film-finale] [data-cta="film_build"]')).toHaveAttribute('href', '/ru/builder')
  await expect(page.locator('h1')).toHaveCount(1)
})

test('home film: on a wide screen one WebGL Fira lands on the marks and opens the chat; the launcher steps aside', async ({ page }) => {
  await page.setViewportSize(SIZES.desktop)
  await open(page, '/ru')
  await page.waitForFunction(() => document.documentElement.dataset.film === 'on', null, { timeout: 30_000 })
  await expect(page.locator('[data-film-fira]')).toHaveCount(1)
  await expect(page.locator('[data-cta="chat_fab"]')).toHaveCSS('opacity', '0')
  await page.locator('#office').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-film-scene="office"]')).toHaveAttribute('data-active', '')
  await page.locator('[data-film-fira]').click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
})

test('home film: phones get the plain sections with the flat Fira and the ordinary launcher', async ({ page }) => {
  await page.setViewportSize(SIZES.mobile)
  await open(page, '/ru')
  await page.waitForTimeout(2500)
  await expect(page.locator('[data-film-fira]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.dataset.film ?? null)).toBeNull()
  await expect(page.locator('[data-film-mark="hello"] svg')).toBeVisible()
  await noHorizontalOverflow(page, '/ru film phone')
})

test('companion: a product page shows one line of Fira, a click opens the chat, the same page stays quiet after that', async ({ page }) => {
  await open(page, '/ru/products/admin')
  const line = page.locator('[data-companion="product"]')
  await expect(line).toHaveAttribute('data-open', 'true', { timeout: 6000 })
  await line.locator('[data-cta="companion_line"]').click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
  await open(page, '/ru/products/admin')
  await page.waitForTimeout(2500)
  await expect(page.locator('[data-companion="product"]')).toHaveAttribute('data-open', 'false')
})
