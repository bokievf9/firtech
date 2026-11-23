import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// «Самые нужные агенты» on the home page (v6 B2): seven cards, the nav item, the builder link, no overflow.
for (const [label, size] of Object.entries(SIZES)) {
  test.describe(`home agents at ${label}`, () => {
    test.use({ viewport: size })

    test('cards visible, «Собрать» opens the builder', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru')
      const section = page.locator('[data-home-agents]')
      await section.scrollIntoViewIfNeeded()
      await expect(section.getByRole('heading', { level: 2, name: 'Самые нужные агенты' })).toBeVisible()
      await expect(section.locator('[data-home-agent-card]')).toHaveCount(7)
      const first = section.locator('[data-home-agent-card="lead-handler"]')
      await expect(first).toBeVisible()
      await expect(first.getByText(/^от\s[\d\s]+USD разово \+ [\d\s]+USD\/мес$/)).toBeVisible()
      await first.getByRole('link', { name: 'Собрать' }).click()
      await page.waitForURL(/\/ru\/builder\?b=/)
      expect(errors).toEqual([])
    })

    test('no horizontal overflow', async ({ page }) => {
      await open(page, '/ru')
      await noHorizontalOverflow(page)
    })
  })
}

test('nav «Агенты» opens /ai-team on the popular filter', async ({ page }) => {
  await page.setViewportSize(SIZES.desktop ?? { width: 1440, height: 900 })
  await open(page, '/ru')
  await page.getByRole('navigation').first().getByRole('link', { name: 'Агенты', exact: true }).click()
  await page.waitForURL(/\/ru\/ai-team#agents/)
  await expect(page.locator('[data-agents-team="popular"]')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-agent-card]')).toHaveCount(6)
})
