import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ «Finance» (2026-11-23): Invoices (the back-office panel), Payments and Costs over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Finance refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/finance')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('Invoices is the default tab and shows the existing panel', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/finance')
    await expect(page.getByRole('heading', { name: 'Finance', level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Invoices', selected: true })).toBeVisible()
    await expect(page.getByText('FT-2026-006').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('Payments: month total, stage split, the table and the month switch', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/finance?tab=payments')
    await expect(page.getByRole('tab', { name: 'Payments', selected: true })).toBeVisible()
    await expect(page.locator('[data-stat="paid"]')).toContainText(/\$\d/)
    await expect(page.locator('[data-stage="1"]')).toBeVisible()
    await expect(page.locator('[data-payment="FT-2026-005"]')).toBeVisible()
    await expect(page.locator('[data-stat="awaiting"]')).toContainText('$1')
    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(page.locator('[data-payments-table]')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled()
    expect(errors).toEqual([])
  })

  test('Costs: departments against limits, agents, the daily bars', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/finance?tab=costs')
    await expect(page.getByRole('tab', { name: 'Costs', selected: true })).toBeVisible()
    await expect(page.locator('[data-stat="total"]')).toBeVisible()
    await expect(page.locator('[data-dept="marketing"]')).toBeVisible()
    await expect(page.locator('[data-dept="marketing"] [data-agent]').first()).toBeVisible()
    await expect(page.locator('[data-by-day]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('no horizontal overflow on a phone', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    for (const tab of ['invoices', 'payments', 'costs']) {
      await open(page, `/admin/finance?tab=${tab}`)
      await noHorizontalOverflow(page, tab)
    }
  })
})
