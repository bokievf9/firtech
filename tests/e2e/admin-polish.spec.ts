import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Shell polish, 2026-11-23: ⌘K targets are found, marked (aria-current + data-focus-row) and scrolled into view
// for every result type; one Select; toasts on actions. Dev mock of HQ, hand-written admin session.

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  const cases: [string, string, string][] = [
    ['client', '/admin/clients?tab=clients&focus=c:Pulse%20Gym', 'c:Pulse Gym'],
    ['lead', '/admin/clients?tab=pipeline&focus=7', '7'],
    ['project', '/admin/projects?tab=projects&focus=2', '2'],
    ['invoice', '/admin/finance?tab=invoices&focus=6', '6'],
    ['task', '/admin/tasks?task=12', '12'],
  ]
  for (const [type, url, id] of cases) {
    test(`⌘K ${type} result: the row is marked and in view`, async ({ page }) => {
      const errors = watchErrors(page, noise)
      await open(page, url)
      const row = page.locator(`[data-focus-row="${id}"]`).first()
      await expect(row).toBeVisible()
      await expect(row).toHaveAttribute('aria-current', 'true')
      await expect(row).toBeInViewport()
      expect(errors).toEqual([])
    })
  }

  test('the Select is one styled control (tasks filters, mobile has no overflow)', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/tasks')
    const select = page.locator('select#tasks-status')
    await expect(select).toBeVisible()
    expect(await select.evaluate((el) => getComputedStyle(el).appearance)).toBe('none')
    await noHorizontalOverflow(page, 'tasks')
  })
})
