import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// The loss block in the agent step («Сколько вы теряете без агента»): visible on the estimate screen (open on wide, behind
// «Посчитать потери» on a phone), the result follows the inputs, and one comparison line carries the agent's price.
const URL = '/ru/builder?b=a.lead-handler.telegram._.m.path&step=7'

for (const [label, size] of Object.entries(SIZES)) {
  test.describe(`builder loss block at ${label}`, () => {
    test.use({ viewport: size })

    test('block, inputs, result and comparison', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, URL)
      const block = page.locator('[data-loss-block]')
      await expect(block).toBeVisible()
      await expect(block).toContainText('Сколько вы теряете без агента')
      if (label === 'mobile') {
        await expect(page.locator('[data-loss-fields]')).toBeHidden()
        await page.getByRole('button', { name: 'Посчитать потери' }).click()
      }
      await expect(page.locator('[data-loss-fields]')).toBeVisible()
      await page.locator('[data-loss-input="missedPerDay"]').fill('10')
      await page.locator('[data-loss-input="avgCheck"]').fill('100')
      await page.locator('[data-loss-input="offHoursShare"]').fill('50')
      // 10 x 30 x 50 % = 150 inquiries; x 100 x 30 % = 4500
      await expect(page.locator('[data-loss-result]')).toContainText('150 обращений')
      await expect(page.locator('[data-loss-result]')).toContainText('4,500 USD')
      await page.locator('[data-loss-input="avgCheck"]').fill('200')
      await expect(page.locator('[data-loss-result]')).toContainText('9,000 USD')
      await expect(page.locator('[data-loss-compare]')).toContainText(/Агент: [\d,]+ USD разово \+ [\d,]+ USD\/мес/)
      await expect(page.locator('[data-agent-estimate]')).toBeVisible()
      expect(page.url()).toMatch(/e\./)
      await noHorizontalOverflow(page, 'loss block')
      expect(errors).toEqual([])
    })
  })
}
