import { expect, test } from '@playwright/test'
import { adminContext, open, SIZES } from './helpers'

// «Delete old materials» in the Content section over the dev mock of HQ: dry run, numbers, the published checkbox, delete, toast.
test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('the dialog counts first, the checkbox adds published, the delete clears the list', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/content?tab=feed')
    const feed = page.locator('[data-feed] li')
    await expect(feed.first()).toBeVisible()
    await page.locator('[data-purge="open"]').click()
    const dialog = page.locator('[data-purge="dialog"]')
    await expect(dialog).toBeVisible()
    const materials = dialog.locator('[data-purge-count="materials"]')
    await expect(materials).toBeVisible()
    const base = Number(await materials.innerText())
    expect(base).toBeGreaterThan(0)
    await expect(dialog.locator('[data-purge="warning"]')).toHaveCount(0)
    await expect(dialog.locator('[data-purge="confirm"]')).toContainText(`Delete ${base} materials`)
    // Published articles: a warning and a bigger number
    await dialog.locator('[data-purge="published"]').check()
    await expect(dialog.locator('[data-purge="warning"]')).toContainText('disappear from the blog')
    await expect(dialog.locator('[data-purge="confirm"]')).not.toContainText(`Delete ${base} materials`)
    await dialog.locator('[data-purge="published"]').uncheck()
    await expect(dialog.locator('[data-purge="confirm"]')).toContainText(`Delete ${base} materials`)
    await dialog.locator('[data-purge="confirm"]').click()
    await expect(page.getByRole('status').filter({ hasText: `Deleted ${base} materials` })).toBeVisible()
    await expect(dialog).toHaveCount(0)
    // Only waiting and published materials are left in the feed
    const statuses = await page.locator('[data-feed] li').allInnerTexts()
    expect(statuses.join(' ')).not.toMatch(/Rejected|Draft/)
    // Nothing more to delete now
    await page.locator('[data-purge="open"]').click()
    await expect(page.locator('[data-purge="dialog"] [data-purge="confirm"]')).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-purge="dialog"]')).toHaveCount(0)
  })
})
