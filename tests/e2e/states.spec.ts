import { expect, test, type Page } from '@playwright/test'
import ru from '../../src/content/ru'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { adminContext, open, openHomeForChat } from './helpers'

// Loading and error states (owner review 2026-11-22 point 7): a failing /api/chat and /api/lead must
// show the reason in words and a retry button, the pending button is `aria-busy`, and the retry works
// without losing what was typed. Set STATES_SHOTS to a folder to save screenshots of the states.
const shotsDir = process.env.STATES_SHOTS
async function shot(page: Page, locator: ReturnType<Page['locator']>, name: string) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(250)
  await locator.screenshot({ path: path.join(shotsDir, `${name}.png`) })
}

const signedIn = (page: Page) =>
  page.route('**/api/cabinet/me', (route) =>
    route.fulfill({ json: { enabled: true, signedIn: true, email: 'e2e@example.com', name: 'E2E', telegram: '' } }),
  )

test('chat: a 500 and a dropped connection show the reason and «Повторить»; the retry sends the same text', async ({ page }) => {
  let calls = 0
  await page.route('**/api/chat', async (route) => {
    calls++
    const body = route.request().postDataJSON() as { message: string }
    if (body.message === 'Привет') {
      if (calls === 2) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return route.fulfill({ status: 500, json: { ok: false, error: { code: 'server_error', message: 'x' } } })
      }
      if (calls === 3) return route.abort('connectionreset')
      return route.fulfill({ json: { ok: true, reply: 'Здравствуйте! Чем помочь?', state: 'chat' }, headers: { 'x-chat-mode': 'hq' } })
    }
    return route.fulfill({ json: { ok: true, reply: 'Здравствуйте.', state: 'chat' }, headers: { 'x-chat-mode': 'hq' } })
  })
  await openHomeForChat(page)
  await page.getByRole('button', { name: ru.chat.fab }).click()
  const dialog = page.locator('[role=dialog]')
  await expect(dialog).toContainText('Здравствуйте.')
  await dialog.locator('textarea').fill('Привет')
  await dialog.getByLabel('Отправить').click()
  // While the answer is on the way the visitor sees the typing indicator.
  await expect(dialog.getByLabel(/печатает/i)).toBeVisible()
  await shot(page, dialog, 'chat-pending')
  await expect(dialog).toContainText('Ошибка на сервере')
  await expect(dialog.getByRole('button', { name: /Повторить/ })).toBeVisible()
  await shot(page, dialog, 'chat-error')
  // Retry meets a dropped connection: another reason, another retry.
  await dialog.getByRole('button', { name: /Повторить/ }).click()
  await expect(dialog).toContainText('Нет связи')
  await shot(page, dialog, 'chat-no-connection')
  await dialog.getByRole('button', { name: /Повторить/ }).click()
  await expect(dialog).toContainText('Здравствуйте! Чем помочь?')
  await expect(dialog.getByRole('button', { name: /Повторить/ })).toHaveCount(0)
  await shot(page, dialog, 'chat-ok')
})

test('builder send: pending is aria-busy, a 500 shows the reason and «Повторить», the retry succeeds', async ({ page }) => {
  await signedIn(page)
  let calls = 0
  await page.route('**/api/lead', async (route) => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 900))
    if (calls === 1) return route.fulfill({ status: 500, json: { ok: false, error: { code: 'server_error', message: 'x' } } })
    if (calls === 2) return route.fulfill({ status: 504, json: { ok: false, error: { code: 'timeout', message: 'x' } } })
    return route.fulfill({ json: { ok: true, cabinet: null } })
  })
  await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe~s.premium.amber.dark.soft~d.5.ru-en.logo.month&step=8')
  const box = page.locator('#contact')
  const send = box.getByRole('button', { name: 'Отправить проект в работу' })
  await expect(send).toHaveAttribute('aria-busy', 'false')
  await shot(page, box, 'builder-send-idle')
  await send.click()
  const busy = box.getByRole('button', { name: /Отправляем/ })
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  await shot(page, box, 'builder-send-pending')
  const alert = box.getByRole('alert')
  await expect(alert).toContainText('Ошибка на сервере')
  await expect(alert.getByRole('button', { name: 'Повторить' })).toBeVisible()
  await shot(page, box, 'builder-send-error')
  await alert.getByRole('button', { name: 'Повторить' }).click()
  await expect(box.getByRole('alert')).toContainText('Сервер не ответил за 20 секунд')
  await box.getByRole('alert').getByRole('button', { name: 'Повторить' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Заявка у нас' })).toBeVisible()
  expect(calls).toBe(3)
  await shot(page, page.getByRole('status').filter({ hasText: 'Заявка у нас' }), 'builder-send-success')
})

for (const [locale, title, queuedText] of [
  ['ru', 'Заявка у нас', 'Заявка сохранена и уйдёт в работу, как только сервер ответит'],
  ['en', 'Request received', 'Request saved and will go to work as soon as the server answers'],
] as const) {
  test(`builder send (${locale}): a queued lead (HQ down) shows the saved text, not the plain success`, async ({ page }) => {
    await signedIn(page)
    await page.route('**/api/lead', (route) => route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/' + locale + '/cabinet' } }))
    await open(page, `/${locale}/builder?b=websites.landing.telegram~k.cafe~s.premium.amber.dark.soft~d.5.ru-en.logo.month&step=8`)
    await page.locator('#contact').getByRole('button').first().click()
    const status = page.getByRole('status').filter({ hasText: title })
    await expect(status).toContainText(queuedText)
  })
}

test('audit form: the field text survives a failed send and the retry goes through', async ({ page }) => {
  await signedIn(page)
  let calls = 0
  await page.route('**/api/audit', async (route) => {
    calls++
    if (calls === 1) return route.fulfill({ status: 503, json: { ok: false, error: { code: 'unavailable', message: 'x' } } })
    return route.fulfill({ json: { ok: true, mock: true, cabinet: null } })
  })
  await open(page, '/ru/audit')
  await page.getByLabel('Ссылка на сайт или Instagram').fill('https://example.com')
  await page.getByLabel('Telegram или телефон').fill('@alice_b')
  await page.getByRole('button', { name: 'Заказать аудит' }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'Сервис временно недоступен' })
  await expect(alert).toBeVisible()
  await expect(page.getByLabel('Ссылка на сайт или Instagram')).toHaveValue('https://example.com')
  await alert.getByRole('button', { name: 'Повторить' }).click()
  await expect.poll(() => calls).toBe(2)
})

test.describe('Пульт', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('an HQ panel shows the reason in words and a retry that shows its own waiting state', async ({ page }) => {
    let calls = 0
    await page.route('**/api/admin/hq/**', async (route) => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 900))
      // HQ failures come back as 200 {ok:false,error} (the proxy contract), so the page keeps its data.
      return route.fulfill({ json: { ok: false, error: 'hq_timeout' } })
    })
    await page.goto('/admin/approvals')
    const main = page.locator('main').first()
    await shot(page, page.locator('body'), 'pult-loading')
    const alert = main.getByRole('alert')
    await expect(alert).toContainText('Shell не ответил за 5 с')
    await expect(alert.getByRole('button', { name: 'Повторить' })).toBeVisible()
    await shot(page, page.locator('body'), 'pult-error')
    // The retry button works while it waits (aria-busy) and then offers itself again.
    await alert.getByRole('button', { name: 'Повторить' }).click()
    await expect(alert.getByRole('button').first()).toHaveAttribute('aria-busy', 'true')
    expect(calls).toBeGreaterThan(0)
  })
})
