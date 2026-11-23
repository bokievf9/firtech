import { expect, test } from '@playwright/test'
import { fakeSessionCookie, open, watchErrors } from './helpers'

// Client onboarding after a lead (2026-11-24): the builder send shows the success screen (number, three
// steps with ETA, where the answer arrives, the coupon, a 6 s redirect that «Остаться» cancels), the cabinet
// opens on the request path with the new request highlighted, Fira's three-bubble tour runs once, and the
// empty states say what comes next. /api/lead is answered by the test (no HQ in the e2e run); the cabinet
// reads the dev mock of HQ.

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]
const answer = { ok: true, id: 7, token: 'abcdef12', slot: null, hqLeadId: 14, queued: false, cabinet: '/ru/cabinet?lead=14', coupon: 'FRIEND10' }

test.describe('cabinet onboarding', () => {
  test.setTimeout(150_000)
  test.beforeEach(async ({ context, baseURL, page }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
    await page.route('**/api/lead', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) }))
  })

  async function send(page: import('@playwright/test').Page) {
    await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8#contact')
    await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
    await expect(page.locator('[data-send-success]')).toBeVisible()
  }

  test('send: success screen with number, three steps, the answer place, the coupon; «Остаться» stops the redirect', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await send(page)
    await expect(page.locator('[data-send-title]')).toContainText('Заявка №14 принята')
    const steps = page.locator('[data-send-steps] li')
    await expect(steps).toHaveCount(3)
    await expect(steps.first()).toContainText('до 1 рабочего дня, обычно быстрее')
    await expect(page.locator('[data-send-answer]')).toContainText('кабинет и на почту anna@example.com')
    await expect(page.locator('[data-send-coupon]')).toContainText('FRIEND10')
    await expect(page.locator('[data-send-open]')).toHaveText('Открыть кабинет')
    await expect(page.locator('[data-send-countdown]')).toBeVisible()
    await page.locator('[data-send-stay]').click()
    await expect(page.locator('[data-send-countdown]')).toHaveCount(0)
    await page.waitForTimeout(7000)
    expect(page.url()).toContain('/builder')
    expect(errors).toEqual([])
  })

  test('send: without «Остаться» the cabinet opens by itself after 6 s, on the request path, the new request first', async ({ page }) => {
    await send(page)
    await page.waitForURL(/\/ru\/cabinet\?lead=14/, { timeout: 15_000 })
    const lead = page.locator('[data-lead="14"]')
    await expect(lead).toBeVisible()
    await expect(lead).toHaveAttribute('data-lead-focused', 'true')
    await expect(lead.locator('[data-journey-steps] li')).toHaveCount(6)
    await expect(lead.locator('[data-journey-steps] li[aria-current="step"]')).toHaveCount(1)
    await expect(lead.locator('[data-journey-now]')).toContainText('Сейчас мы…')
    await expect(lead.locator('[data-journey-answer]')).toContainText('Ответ придёт…')
    await expect(lead).not.toContainText('основател')
    await expect(page.locator('[data-lead]').first()).toHaveAttribute('data-lead', '14')
  })

  test('tour: three Fira bubbles in order, «Понятно» ends them, they do not come back after a reload', async ({ page }) => {
    await open(page, '/ru/cabinet')
    const bubble = page.locator('[data-tour-bubble]')
    await expect(bubble).toHaveAttribute('data-tour-bubble', 'projects')
    await expect(bubble).toContainText('Проекты')
    await page.locator('[data-tour-next]').click()
    await expect(bubble).toHaveAttribute('data-tour-bubble', 'documents')
    await page.locator('[data-tour-next]').click()
    await expect(bubble).toHaveAttribute('data-tour-bubble', 'messages')
    await expect(page.locator('[data-tour-next]')).toHaveText('Понятно')
    await page.locator('[data-tour-next]').click()
    await expect(bubble).toHaveCount(0)
    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('[data-cabinet-tab="projects"]')).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(page.locator('[data-tour-bubble], [data-tour-static]')).toHaveCount(0)
  })

  test('tour under reduced motion: static hints, once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '/ru/cabinet')
    const note = page.locator('[data-tour-static]')
    await expect(note).toBeVisible()
    await expect(note).toContainText('Документы')
    await expect(page.locator('[data-tour-bubble]')).toHaveCount(0)
    await page.locator('[data-tour-done]').click()
    await expect(note).toHaveCount(0)
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await expect(page.locator('[data-tour-static]')).toHaveCount(0)
  })
})
