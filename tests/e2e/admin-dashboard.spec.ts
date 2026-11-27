import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, watchErrors } from './helpers'

// Shell Dashboard «today» (2026-11-27): the first screen over the dev mock of HQ's GET /admin/today. The mock computes it
// from the same rows as Approvals and Finance, so the numbers here equal theirs. SHOTS_DIR saves screenshots.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]
const SHOTS = process.env.SHOTS_DIR
const BLOCKS = ['decide', 'hotLeads', 'money', 'funnel', 'team', 'alerts'] as const

test('the Dashboard refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/dashboard')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('/admin opens the Dashboard: every block, the overnight line, the date and the update time', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    for (const id of BLOCKS) {
      await expect(page.locator(`[data-block="${id}"]`)).toBeVisible()
      await expect(page.locator(`[data-block="${id}"]`)).toHaveAttribute('data-available', 'yes')
    }
    await expect(page.locator('[data-night]')).toContainText('Overnight')
    await expect(page.locator('[data-updated]')).toContainText(/Updated \d\d:\d\d/)
    await expect(page.locator('[data-block="money"] [data-spark] span')).toHaveCount(7)
    await expect(page.locator('[data-funnel-step]')).toHaveCount(4)
    await expect(page.locator('[data-decide-row]').first()).toBeVisible()
    expect(await page.locator('[data-decide-row]').count()).toBeLessThanOrEqual(5)
    // no refresh button: the page refreshes itself
    await expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('the lg+ layout is two columns: waiting and hot leads on the left, money, funnel, team, alerts on the right', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/admin/dashboard')
    await expect(page.locator('[data-block="decide"]')).toBeVisible()
    const box = async (id: string) => (await page.locator(`[data-block="${id}"]`).boundingBox())!
    const [decide, hot, money, funnel, team, alerts] = await Promise.all(BLOCKS.map(box))
    expect(hot!.x).toBeCloseTo(decide!.x, 0)
    expect(money!.x).toBeGreaterThan(decide!.x + decide!.width)
    expect(funnel!.x).toBeCloseTo(money!.x, 0)
    expect(team!.y).toBeGreaterThan(funnel!.y)
    expect(alerts!.y).toBeGreaterThan(team!.y)
    expect(decide!.width).toBeGreaterThan(money!.width)
  })

  test('390: one column in the order of the contract, the chip row jumps to a block', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, '/admin/dashboard')
    await expect(page.locator('[data-block="alerts"]')).toBeAttached()
    const ys = await Promise.all(BLOCKS.map(async (id) => (await page.locator(`[data-block="${id}"]`).boundingBox())!.y))
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    const xs = await Promise.all(BLOCKS.map(async (id) => (await page.locator(`[data-block="${id}"]`).boundingBox())!.x))
    expect(new Set(xs.map((x) => Math.round(x))).size).toBe(1)
    await page.locator('[data-jump]').getByRole('button', { name: /^Team/ }).click()
    await expect(page.locator('[data-block="team"]')).toBeInViewport()
    await noHorizontalOverflow(page, 'dashboard 390')
  })

  test('approving a row collapses it and lowers the count in the block, the menu and Approvals', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/admin/dashboard')
    const total = page.locator('[data-decide-total]')
    const before = Number(await total.getAttribute('data-n'))
    expect(before).toBeGreaterThan(0)
    await expect(page.locator('[data-badge="dashboard"]').first()).toHaveText(String(before))
    const row = page.locator('[data-decide-row]').filter({ has: page.locator('[data-decide-action="approve"]') }).first()
    const id = await row.getAttribute('data-decide-row')
    await row.locator('[data-decide-action="approve"]').click()
    await expect(page.locator(`[data-decide-row="${id}"]`)).toHaveCount(0)
    await expect(total).toHaveAttribute('data-n', String(before - 1))
    await expect(page.locator('[data-badge="dashboard"]').first()).toHaveText(String(before - 1))
    await expect(page.locator('[data-badge="approvals"]').first()).toHaveText(String(before - 1))
    await expect(page.getByText(/^Approved: /)).toBeVisible()
    // the queue of the mock really moved: Approvals shows the same number across its four queues
    await open(page, '/admin/approvals')
    const nav = page.getByRole('navigation', { name: 'Approvals sections' })
    let sum = 0
    for (const name of ['Documents', 'Replies', 'Content', 'Money']) sum += Number(await nav.getByRole('button', { name }).locator('span').textContent())
    expect(sum).toBe(before - 1)
  })

  test('«Ещё N» leads to Approvals and Open leads to the item', async ({ page }) => {
    await open(page, '/admin/dashboard')
    const more = page.locator('[data-decide-more]')
    if (await more.count()) {
      await more.click()
      await expect(page).toHaveURL(/\/admin\/approvals$/, { timeout: 40_000 })
      await open(page, '/admin/dashboard')
    }
    await page.locator('[data-decide-row]').first().locator('[data-decide-action="open"]').click()
    await expect(page).toHaveURL(/\/admin\/approvals\?id=ap_/, { timeout: 40_000 })
  })

  test('a block HQ did not return says so quietly; the others keep their numbers', async ({ page }) => {
    await page.route('**/api/admin/hq/today**', async (route) => {
      const res = await route.fetch()
      const body = await res.json()
      body.money = { available: false }
      body.night = { available: false }
      await route.fulfill({ response: res, json: body })
    })
    await open(page, '/admin/dashboard')
    await expect(page.locator('[data-block="money"] [data-unavailable]')).toContainText('Shell could not read: money')
    await expect(page.locator('[data-block="money"] [role=alert]')).toHaveCount(0)
    await expect(page.locator('[data-night] ')).toContainText('could not read')
    await expect(page.locator('[data-block="decide"]')).toHaveAttribute('data-available', 'yes')
    await expect(page.locator('[data-block="funnel"]')).toHaveAttribute('data-available', 'yes')
  })

  test('the partial mock variant (tz=Etc/Partial) returns overnight and alerts as unavailable', async ({ page }) => {
    await open(page, '/admin/dashboard')
    const res = await page.request.get('/api/admin/hq/today?tz=Etc/Partial')
    const body = await res.json()
    expect(body.night).toEqual({ available: false })
    expect(body.alerts).toEqual({ available: false })
    expect(body.decide.available).toBe(true)
  })

  test('empty blocks give one sentence and the next step', async ({ page }) => {
    await page.route('**/api/admin/hq/today**', async (route) => {
      const res = await route.fetch()
      const body = await res.json()
      body.decide = { available: true, total: 0, items: [], byKind: {} }
      body.hotLeads = { available: true, items: [] }
      body.alerts = { available: true, items: [] }
      await route.fulfill({ response: res, json: body })
    })
    await open(page, '/admin/dashboard')
    for (const id of ['decide', 'hotLeads', 'alerts']) await expect(page.locator(`[data-block="${id}"] [data-empty]`)).toBeVisible()
    await expect(page.locator('[data-block="decide"] [data-empty]')).toContainText('Nothing is waiting for you.')
  })

  test('a failed load shows a skeleton first, then an inline error with Retry', async ({ page }) => {
    let fail = true
    await page.route('**/api/admin/hq/today**', async (route) => {
      if (!fail) return route.continue()
      await new Promise((r) => setTimeout(r, 2500))
      return route.fulfill({ status: 502, json: { error: 'hq_unreachable' } })
    })
    await page.goto('/admin/dashboard', { waitUntil: 'commit' })
    await expect(page.locator('[data-dashboard-loading]')).toBeVisible()
    await expect(page.locator('main [role=alert]')).toBeVisible()
    fail = false
    await page.locator('main [role=alert]').getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('[data-block="decide"]')).toBeVisible()
  })

  test('keys 1-9 go to the daily sections and need no animation', async ({ page }) => {
    test.setTimeout(240_000)
    await open(page, '/admin/dashboard')
    const keys: Record<string, RegExp> = { '2': /\/admin\/inbox/, '3': /\/admin\/approvals/, '4': /\/admin\/tasks/, '5': /\/admin\/chats/, '6': /\/admin\/clients/, '7': /\/admin\/projects/, '8': /\/admin\/finance/, '9': /\/admin\/team/, '1': /\/admin\/dashboard/ }
    for (const [key, url] of Object.entries(keys)) {
      await page.keyboard.press(key)
      await expect(page).toHaveURL(url, { timeout: 40_000 })
    }
  })

  for (const theme of ['dark', 'light'] as const) {
    test(`no horizontal overflow and a screenshot at 1440 ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.addInitScript((t) => localStorage.setItem('firtech-admin-theme', t), theme)
      await open(page, '/admin/dashboard')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('[data-block="team"]')).toBeVisible()
      await noHorizontalOverflow(page, `dashboard 1440 ${theme}`)
      const wide = await page.evaluate(() => [...document.querySelectorAll('[data-section-view="dashboard"] [data-block]')].filter((el) => el.scrollWidth > el.clientWidth + 1).length)
      expect(wide).toBe(0)
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-1440-${theme}.png` })
    })
  }

  test('screenshot at 390 dark', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, '/admin/dashboard')
    await expect(page.locator('[data-block="decide"]')).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-390.png` })
  })
})
