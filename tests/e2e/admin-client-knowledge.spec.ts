import { expect, test, type Page } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// «Knowledge» tab of the client card over the dev mock of HQ: an import that flips running -> done after a few
// reads, the address check, a failed import, the 3 s polling that stops when the crawl ends.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]
const SHOTS = process.env.KNOWLEDGE_SHOTS

async function openTab(page: Page) {
  await open(page, '/admin/clients?tab=clients')
  await page.getByRole('button', { name: /Алиса/ }).first().click()
  await page.getByRole('button', { name: /^Knowledge/ }).click()
  await expect(page.locator('[data-client-knowledge]')).toBeVisible()
}

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('a client without a cabinet has no knowledge to import', async ({ page }) => {
    await open(page, '/admin/clients?tab=clients')
    await page.getByRole('button', { name: /Боб/ }).first().click()
    await page.getByRole('button', { name: /^Knowledge/ }).click()
    await expect(page.getByText('Knowledge is kept for clients with a cabinet')).toBeVisible()
    await expect(page.locator('[data-client-knowledge]')).toHaveCount(0)
  })

  test('import flow: empty state, validation, failure, polling, pages list', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = watchErrors(page, noise)
    const gets: number[] = []
    const posts: string[] = []
    page.on('request', (r) => {
      if (!r.url().includes('/api/admin/hq/clients/1/knowledge')) return
      if (r.method() === 'GET') gets.push(Date.now())
      else posts.push(r.postData() ?? '')
    })
    await openTab(page)
    const panel = page.locator('[data-client-knowledge]')
    const input = panel.getByLabel('Site address')
    const importBtn = panel.locator('[data-import]')

    // none: empty state, the address is prefilled with the site of the client
    await expect(panel.locator('[data-knowledge-state]')).toHaveText('Not imported')
    await expect(panel).toContainText('Nothing imported yet')
    await expect(input).toHaveValue('https://alice-studio.example')
    await expect(panel.locator('[data-knowledge-page]')).toHaveCount(0)
    await expect(panel.locator('[data-counter="pages"]')).toHaveText('0')
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, `knowledge none ${size.width}`)
    }
    await page.setViewportSize(SIZES.desktop)

    // validation: nothing is sent
    await input.fill('')
    await importBtn.click()
    await expect(panel.locator('[data-knowledge-problem]')).toContainText('Enter the site address first')
    await input.fill('ftp://alice-studio.example')
    await importBtn.click()
    await expect(panel.locator('[data-knowledge-problem]')).toContainText('not a site address')
    expect(posts).toEqual([])

    // an address the server refuses is shown in words, the button is back
    await input.fill('http://127.0.0.1/admin')
    await importBtn.click()
    await expect(panel.locator('[data-knowledge-problem]')).toContainText('not a site address')
    expect(posts.length).toBe(1)
    await expect(importBtn).toHaveAttribute('aria-busy', 'false')

    // a crawl that fails: running with a pending button, then failed with the reason
    await input.fill('https://fail.example')
    await importBtn.click()
    await expect(panel.locator('[data-knowledge-state]')).toHaveText('Reading the site')
    await expect(importBtn).toHaveAttribute('aria-busy', 'true')
    await expect(input).toBeDisabled()
    await expect(panel.locator('[data-knowledge-state]')).toHaveText('Import failed', { timeout: 30_000 })
    await expect(panel.locator('[data-knowledge-job]')).toContainText('the site did not answer')
    await expect(panel).toContainText('Nothing was kept from this site')
    await expect(panel.locator('[data-counter="errors"]')).toHaveText('1')

    // a good one: polls about every 3 s while running, stops afterwards
    await input.fill('https://alice-studio.example')
    const before = gets.length
    await importBtn.click()
    await expect(panel.locator('[data-knowledge-state]')).toHaveText('Reading the site')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/running-1440.png` })
    await expect(panel.locator('[data-knowledge-state]')).toHaveText('Imported', { timeout: 30_000 })
    const during = gets.slice(before)
    expect(during.length).toBeGreaterThanOrEqual(3)
    const gaps = during.slice(2).map((t, i) => t - during[i + 1]!)
    for (const gap of gaps) expect(gap).toBeGreaterThan(2000)
    const settled = gets.length
    await page.waitForTimeout(7000)
    expect(gets.length).toBe(settled)

    await expect(panel.locator('[data-knowledge-page]')).toHaveCount(6)
    await expect(panel.locator('[data-counter="pages"]')).toHaveText('6')
    await expect(panel.locator('[data-counter="chunks"]')).toHaveText('24')
    const first = panel.locator('[data-knowledge-page]').first()
    await expect(first).toContainText('Home')
    await expect(first).toContainText('chars')
    await expect(first.getByRole('link')).toHaveAttribute('href', 'https://alice-studio.example')
    await expect(first.getByRole('link')).not.toHaveAttribute('target', /.*/)
    await expect(panel.locator('[data-knowledge-job]')).toContainText('6 pages, 24 chunks')
    await expect(importBtn).toHaveText('Import again')

    for (const [name, size] of Object.entries(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, `knowledge done ${size.width}`)
      const wide = await panel.evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(wide, 'panel wider than itself').toBeLessThanOrEqual(1)
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/done-${size.width}.png` })
      void name
    }
    expect(errors).toEqual([])
  })
})
