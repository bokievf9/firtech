import { expect, test, type Page } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// The living estimate (builder v6 wave 2): «Сохранить смету» copies the permanent link, «Прислать мне» and
// «Оплатить первый этап» send a lead with an intent (mocked), the honest start line, and the empty state.
const ESTIMATE = '/ru/builder/estimate?b=websites.landing.telegram~bots.booking.payments~k.cafe'
const signedIn = (page: Page) =>
  page.route('**/api/cabinet/me', (route) =>
    route.fulfill({ json: { enabled: true, signedIn: true, email: 'e2e@example.com', name: 'E2E', telegram: '' } }),
  )

for (const [label, size] of Object.entries(SIZES)) {
  test.describe(`estimate live at ${label}`, () => {
    test.use({ viewport: size })

    test('save link, send me, pay first, start line', async ({ page, context, baseURL }) => {
      const errors = watchErrors(page)
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL! })
      await signedIn(page)
      const sent: Record<string, unknown>[] = []
      await page.route('**/api/lead', async (route) => {
        sent.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/ru/cabinet' } })
      })
      await open(page, ESTIMATE)
      await expect(page.locator('[data-estimate-save]')).toBeVisible()
      await expect(page.locator('[data-estimate-save]')).toContainText('она живёт без срока')

      // Save: the permanent link lands in the clipboard, a toast says so.
      await page.locator('[data-cta="estimate_save"]').click()
      await expect(page.getByText('Ссылка скопирована')).toBeVisible()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      expect(copied).toContain('/ru/builder/estimate?b=websites.landing.telegram')

      // Send me: the account email is prefilled, a bad contact is refused, then a lead with intent save-link.
      await page.locator('[data-cta="estimate_send_me"]').click()
      const field = page.locator('#estimate-send-contact')
      await expect(field).toHaveValue('e2e@example.com')
      await field.fill('nope')
      await page.locator('[data-estimate-send-form] button[type=submit]').click()
      await expect(page.locator('[data-estimate-send-form]')).toContainText('Нужна почта')
      expect(sent).toHaveLength(0)
      await field.fill('@fir_client')
      await page.locator('[data-estimate-send-form] button[type=submit]').click()
      await expect(page.locator('[data-estimate-send-done]')).toBeVisible()
      expect(sent[0]).toMatchObject({ intent: 'save-link', contact: '@fir_client' })
      expect(String(sent[0].estimateUrl)).toContain('/ru/builder/estimate?b=')

      // Honest start and the first stage's pay button.
      await expect(page.locator('[data-estimate-start]')).toHaveText('Старт через 3 рабочих дня после оплаты первого этапа.')
      await page.locator('[data-cta="estimate_pay_first"]').click()
      await expect(page.locator('[data-estimate-pay-done]')).toContainText('Счёт на первый этап придёт в кабинет')
      await expect(page.locator('[data-estimate-pay-done] a[href="/ru/pay-how"]')).toBeVisible()
      expect(sent[1]).toMatchObject({ intent: 'pay-first', contact: 'e2e@example.com' })
      await noHorizontalOverflow(page, 'estimate live')
      expect(errors).toEqual([])
    })

    test('empty state offers a fresh start, and the last build is offered once it was seen', async ({ page }) => {
      await signedIn(page)
      await open(page, '/ru/builder/estimate?b=')
      await expect(page.getByRole('heading', { name: 'Сборка не найдена' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Собрать заново' })).toBeVisible()
      await expect(page.locator('[data-last-build]')).toHaveCount(0)
      // Looking at an estimate remembers it.
      await open(page, ESTIMATE)
      await expect(page.locator('[data-estimate-save]')).toBeVisible()
      await open(page, '/ru/builder/estimate?b=')
      const line = page.locator('[data-last-build]')
      await expect(line).toContainText('Продолжить прошлую смету')
      await line.getByRole('link').click()
      await expect(page.locator('[data-estimate-save]')).toBeVisible()
      await open(page, '/ru/builder/estimate?b=')
      await page.locator('[data-last-build]').getByRole('button', { name: 'Не сейчас' }).click()
      await expect(page.locator('[data-last-build]')).toHaveCount(0)
      await noHorizontalOverflow(page, 'estimate empty')
    })
  })
}
