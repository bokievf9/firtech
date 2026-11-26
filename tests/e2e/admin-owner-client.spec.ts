import { expect, test } from '@playwright/test'
import { adminContext, open, SIZES } from './helpers'

// «Client from owner» in Clients > Pipeline over the dev mock of HQ: validation, success toast, the new lead with its badge and hint.
test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('the dialog validates, adds the client and the lead shows «From owner»', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/clients?tab=pipeline')
    await page.locator('[data-owner-client="open"]').click()
    const dialog = page.locator('[data-owner-client="dialog"]')
    await expect(dialog).toBeVisible()
    // Empty submit: the two required fields complain, nothing is sent
    await dialog.locator('[data-owner-client="submit"]').click()
    await expect(dialog.locator('[data-owner-error="name"]')).toBeVisible()
    await expect(dialog.locator('[data-owner-error="need"]')).toBeVisible()
    // A link without http(s)
    await dialog.locator('[data-owner-field="name"]').fill('Owner Cafe')
    await dialog.locator('[data-owner-field="need"]').fill('A site with a menu and table booking')
    await dialog.locator('[data-owner-field="links"]').fill('example.com')
    await dialog.locator('[data-owner-client="submit"]').click()
    await expect(dialog.locator('[data-owner-error="links"]')).toContainText('http')
    await expect(dialog.locator('[data-owner-error="name"]')).toHaveCount(0)
    await dialog.locator('[data-owner-field="links"]').fill('https://example.com/menu')
    await dialog.locator('[data-owner-client="submit"]').click()
    await expect(page.getByRole('status').filter({ hasText: 'Client added, Sales is on it' })).toBeVisible()
    await expect(dialog).toHaveCount(0)
    // The new lead is on the board with the badge and, without a contact, the hint
    const card = page.locator('li, [role="listitem"], button').filter({ hasText: 'Owner Cafe' }).first()
    await expect(card).toBeVisible()
    await expect(page.locator('[data-lead-badge="owner"]').first()).toHaveText('From owner')
    await expect(page.locator('[data-lead-hint="no-contact"]').first()).toContainText('replies go to you to forward')
  })

  test('Escape closes the dialog', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/clients?tab=pipeline')
    await page.locator('[data-owner-client="open"]').click()
    await expect(page.locator('[data-owner-client="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-owner-client="dialog"]')).toHaveCount(0)
  })
})
