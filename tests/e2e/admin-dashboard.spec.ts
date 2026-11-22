import { expect, test, type Page } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, watchErrors } from './helpers'

// Shell Dashboard (2026-11-23): the home page over the dev mock of HQ. The mock computes the Dashboard from the same rows
// as the Approvals page and Finance, so the numbers here must equal theirs (convergence). SHOTS_DIR saves screenshots.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]
const SHOTS = process.env.SHOTS_DIR

const n = async (page: Page, selector: string) => Number(await page.locator(selector).first().getAttribute('data-n'))
const dollars = (text: string) => [...text.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1]!.replace(/,/g, '')))

test('the Dashboard refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/dashboard')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('/admin opens the Dashboard: tiles, three charts, range switch', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    for (const id of ['leads-new', 'leads-work', 'conversion', 'approvals', 'money', 'projects', 'tickets', 'content', 'agents', 'services', 'spend', 'funnel']) {
      await expect(page.locator(`[data-tile="${id}"]`)).toBeVisible()
      await expect(page.locator(`[data-tile="${id}"]`)).toHaveAttribute('data-available', 'yes')
    }
    await expect(page.getByRole('img', { name: /^Leads per day/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /^Revenue per week/ })).toBeVisible()
    await expect(page.locator('[data-funnel-step="leads"]')).toBeVisible()
    await expect(page.locator('[data-dashboard-range="7d"]')).toBeVisible()
    await page.locator('[data-range="30d"]').click()
    await expect(page.locator('[data-dashboard-range="30d"]')).toBeVisible()
    await expect(page.locator('[data-range="30d"]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-range="today"]').click()
    await expect(page.locator('[data-dashboard-range="today"]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a chart shows its numbers on hover and as a table', async ({ page }) => {
    await open(page, '/admin/dashboard')
    const chart = page.locator('[data-tile="revenue-chart"]')
    await chart.locator('svg').hover({ position: { x: 200, y: 60 } })
    await expect(chart.locator('[data-chart-tip]')).toBeVisible()
    await chart.getByText('Show as a table').click()
    await expect(chart.getByRole('table')).toBeVisible()
  })

  test('convergence: approvals by type equal the Approvals page, money equals Finance', async ({ page }) => {
    await open(page, '/admin/dashboard')
    const tabs = ['documents', 'replies', 'content', 'money'] as const
    const dash: Record<string, number> = {}
    for (const t of tabs) dash[t] = await n(page, `[data-approvals-tab="${t}"]`)
    const waiting = await n(page, '[data-tile="approvals"] [data-value]')
    expect(tabs.reduce((s, t) => s + dash[t]!, 0)).toBe(waiting)

    await page.locator('[data-range="30d"]').click()
    await expect(page.locator('[data-dashboard-range="30d"]')).toBeVisible()
    const paid = await n(page, '[data-stat="money-paid"] [data-value]')
    const pending = await n(page, '[data-stat="money-pending"] [data-value]')
    const overdue = await n(page, '[data-stat="money-overdue"] [data-value]')

    // Approvals page: the same four numbers on its tabs
    await open(page, '/admin/approvals')
    const nav = page.getByRole('navigation', { name: 'Approvals sections' })
    const label = { documents: 'Documents', replies: 'Replies', content: 'Content', money: 'Money' }
    for (const t of tabs) {
      const text = await nav.getByRole('button', { name: new RegExp(`^${label[t]}`) }).innerText()
      expect(Number(text.replace(/\D+/g, ' ').trim().split(' ').pop()), t).toBe(dash[t])
    }

    // Finance: awaiting = pending + overdue; paid in the 30-day window = this month + the month before (every mock payment is that recent)
    await open(page, '/admin/finance?tab=payments')
    const awaiting = dollars(await page.locator('[data-stat="awaiting"]').innerText())[0]!
    expect(pending + overdue).toBe(awaiting)
    const [thisMonth, lastMonth] = dollars(await page.locator('[data-stat="paid"]').innerText())
    expect(paid).toBe(thisMonth! + lastMonth!)
  })

  test('a click on an approvals type opens that tab of Approvals', async ({ page }) => {
    await open(page, '/admin/dashboard')
    await page.locator('[data-approvals-tab="money"]').click()
    await expect(page).toHaveURL(/\/admin\/approvals\?tab=money/)
  })

  test('a broken source greys out only its own tile; a failed load shows a retry', async ({ page }) => {
    await page.route('**/api/admin/hq/dashboard**', async (route) => {
      const res = await route.fetch()
      const body = await res.json()
      body.money = { available: false }
      await route.fulfill({ response: res, json: body })
    })
    await open(page, '/admin/dashboard')
    await expect(page.locator('[data-tile="money"] [data-unavailable]')).toContainText('Source unavailable')
    await expect(page.locator('[data-tile="revenue-chart"] [data-unavailable]')).toBeVisible()
    await expect(page.locator('[data-tile="leads-new"]')).toHaveAttribute('data-available', 'yes')
    await expect(page.locator('[data-tile="approvals"]')).toHaveAttribute('data-available', 'yes')

    await page.unroute('**/api/admin/hq/dashboard**')
    let fail = true
    await page.route('**/api/admin/hq/dashboard**', (route) => (fail ? route.fulfill({ status: 502, json: { error: 'hq_unreachable' } }) : route.continue()))
    await open(page, '/admin/dashboard')
    await expect(page.locator('main [role=alert]')).toBeVisible()
    fail = false
    await page.locator('main [role=alert]').getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('[data-tile="leads-new"]')).toBeVisible()
  })

  for (const [name, size] of [['390', { width: 390, height: 844 }], ['768', { width: 768, height: 1024 }], ['1440', { width: 1440, height: 900 }]] as const) {
    test(`no horizontal overflow at ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await open(page, '/admin/dashboard')
      await expect(page.locator('[data-tile="spend"]')).toBeVisible()
      await noHorizontalOverflow(page, `dashboard ${name}`)
      const wide = await page.evaluate(() => [...document.querySelectorAll('[data-section-view="dashboard"] [data-tile]')].filter((el) => el.scrollWidth > el.clientWidth + 1).length)
      expect(wide).toBe(0)
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-${name}.png`, fullPage: false })
    })
  }
})
