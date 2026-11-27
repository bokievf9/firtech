import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors, openMore } from './helpers'

// HQ «Processes» (2026-11-23): the chain map and the drill button over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Processes refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/processes')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('the chain map shows five chains with step health and a failure text', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/processes')
    await expect(page.getByRole('heading', { name: 'Processes', level: 1 })).toBeVisible()
    for (const id of ['client', 'support', 'content', 'letters', 'infra']) await expect(page.locator(`[data-chain="${id}"]`)).toBeVisible()
    await expect(page.locator('[data-chain="client"]')).toHaveAttribute('data-health', 'fail')
    await expect(page.locator('[data-step="sign"]')).toHaveAttribute('data-health', 'fail')
    await expect(page.locator('[data-step="sign"]')).toContainText('PDF не собран')
    await expect(page.locator('[data-processes-summary]')).toContainText('Steps: 18')
    expect(errors).toEqual([])
  })

  test('the drill: start, it runs, the second start is blocked, clear asks first and resets', async ({ page }) => {
    await open(page, '/admin/processes')
    const drill = page.locator('[data-drill]')
    await expect(drill).toHaveAttribute('data-drill', 'none')
    await expect(page.getByRole('button', { name: 'Clear test data' })).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: 'Run drill' }).click()
    await expect(drill).toHaveAttribute('data-drill', 'running')
    await expect(page.locator('[data-drill-row]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run drill' })).toBeDisabled()
    await page.getByRole('button', { name: 'Clear test data' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(drill).toHaveAttribute('data-drill', 'none')
  })

  test('the menu opens Processes (no placeholder) and there is no horizontal overflow', async ({ page }) => {
    await open(page, '/admin/inbox')
    await openMore(page)
    await page.getByRole('link', { name: /^Processes/ }).first().click()
    await expect(page).toHaveURL(/\/admin\/processes/)
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Processes$/ }).first()).toBeVisible()
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, '/admin/processes')
    }
  })
})
