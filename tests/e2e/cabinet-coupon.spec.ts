import { expect, test } from '@playwright/test'
import { fakeSessionCookie, open } from './helpers'

// Cabinet coupon (contract coupon/contract.md): a signed-in client with a valid coupon (the dev mock of HQ carries
// one, 10 %, ten days left) sees the discount line on the builder summary and the estimate, the sticky total follows
// it, the lead carries brief.coupon, and the cabinet «Проекты» tab shows the banner with «Собрать проект».
// Signed out there is no coupon line, and the gate speaks of the coupon.


test.describe('cabinet coupon', () => {
  test.setTimeout(120_000)

  test('signed in: the builder summary and the estimate show the coupon line and the lower total', async ({ page, context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
    await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8')
    const line = page.locator('[data-estimate-coupon]').first()
    await expect(line).toBeVisible()
    await expect(line).toContainText('Купон за кабинет -10 %')
    await expect(line).toContainText('-$')
    await open(page, '/ru/builder/estimate?b=websites.landing.telegram')
    await expect(page.locator('[data-estimate-coupon]').first()).toContainText('Купон за кабинет -10 %')
  })

  test('signed in: the lead carries brief.coupon = cabinet10', async ({ page, context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
    let body: { brief?: { coupon?: string } } = {}
    await page.route('**/api/lead', async (route) => {
      body = route.request().postDataJSON()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 7, token: 'abcdef12', slot: null, hqLeadId: 14, queued: false, cabinet: '/ru/cabinet?lead=14' }) })
    })
    await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8#contact')
    await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
    await expect(page.locator('[data-send-success]')).toBeVisible()
    expect(body.brief?.coupon).toBe('cabinet10')
  })

  test('signed out: no coupon line in the builder', async ({ page }) => {
    await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8')
    await expect(page.locator('[data-estimate-coupon]')).toHaveCount(0)
  })

  test('cabinet «Проекты»: the banner with the date and «Собрать проект»', async ({ page, context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
    await open(page, '/ru/cabinet')
    const banner = page.locator('[data-coupon-banner]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/Ваш купон 10 % действует до \d{2}\.\d{2}\.\d{4}/)
    await expect(banner.getByRole('link', { name: 'Собрать проект' })).toHaveAttribute('href', '/ru/builder')
  })
})
