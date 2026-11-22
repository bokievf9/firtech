import { expect, test } from '@playwright/test'
import { adminContext, fakeSessionCookie, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Site under the new HQ contracts (agents «Деньги и документы» and «Клиент заметит», 2026-11-23): the HQ booking
// route, the cabinet (?thread=, the review form, rejecting a quote, the demo page) and the Пульт (call buttons, the
// stage «готов» with HQ's hint, cabinet documents with a resend, reviews). Dev mock of HQ; the mocks keep their state
// for the life of the dev server, so every test only moves it forward.

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('HQ books a call window: 401 without the token, 200, the window leaves the free list, 409 for another lead', async ({ request }) => {
  const days = (await (await request.get('/api/slots')).json()).days as { slots: string[] }[]
  const slot = days[days.length - 1]!.slots[days[days.length - 1]!.slots.length - 1]!
  const body = { slot, leadId: 4242, name: 'Али', contact: '@ali', locale: 'ru', source: 'chat' }
  expect((await request.post('/api/slots', { data: body })).status()).toBe(401)
  expect((await request.post('/api/slots', { data: body, headers: { 'x-hq-token': 'wrong' } })).status()).toBe(401)
  const headers = { 'x-hq-token': 'e2e-booking-token' }
  expect((await request.post('/api/slots', { data: body, headers })).status()).toBe(200)
  const after = (await (await request.get('/api/slots')).json()).days as { slots: string[] }[]
  expect(after.some((d) => d.slots.includes(slot))).toBe(false)
  expect((await request.post('/api/slots', { data: { ...body, leadId: 4243 }, headers })).status()).toBe(409)
})

test.describe('cabinet, signed in', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
  })

  test('?thread= opens the messages tab with that thread', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/ru/cabinet?thread=project-1')
    await expect(page.locator('#cabinet-tab-messages')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-thread-item="project-1"]')).toHaveAttribute('aria-current', 'true')
    expect(errors).toEqual([])
  })

  test('support thread: «Вопрос решён» closes the open ticket, a new message brings the button back', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/ru/cabinet?thread=support')
    const bar = page.locator('[data-ticket-bar]')
    await expect(bar).toBeVisible()
    await bar.locator('[data-ticket-resolve]').click()
    await expect(bar).toHaveCount(0)
    // After a reload the mock HQ still has it closed (the newest open ticket is the other one, id 1 is answered).
    await open(page, '/ru/cabinet?thread=support')
    await expect(page.locator('[data-ticket-bar]')).toBeVisible()
    await page.locator('[data-ticket-resolve]').click()
    await expect(page.locator('[data-ticket-bar]')).toHaveCount(0)
    // A new message opens a new ticket: the button is back.
    await page.getByRole('textbox').last().fill('Ещё вопрос про домен')
    await page.getByRole('textbox').last().press('Enter')
    await expect(page.locator('[data-ticket-bar]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a quote can be declined or discussed: the state, the hint and the thread line', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/ru/cabinet?tab=documents&doc=q-14')
    const viewer = page.locator('[data-doc-open="q-14"]')
    await expect(viewer.locator('[data-doc-accept]')).toBeVisible()
    await viewer.locator('[data-doc-reject]').click()
    // An empty answer is refused before anything is sent.
    await viewer.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(viewer.getByText('Напишите несколько слов.')).toBeVisible()
    await viewer.getByRole('radio', { name: 'Обсудить условия' }).check()
    await viewer.getByRole('textbox', { name: /Ваш ответ менеджеру/ }).fill('Хочу обсудить срок и цену этапа 1')
    await viewer.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(viewer.getByText(/Ответ отправлен/)).toBeVisible()
    await expect(viewer.getByText('Отклонено', { exact: true })).toBeVisible()
    await expect(viewer.locator('[data-doc-hint="declined"]')).toBeVisible()
    await expect(viewer.locator('[data-doc-accept]')).toHaveCount(0)
    await expect(viewer.locator('[data-doc-reject]')).toHaveCount(0)
    // Expired quotes say what to do next, with no buttons.
    await page.locator('[data-doc="q-6"]').click()
    await expect(page.locator('[data-doc-open="q-6"] [data-doc-hint="expired"]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('review form: rating and text, thanks with the referral link, a second one is refused kindly', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/ru/cabinet?review=2')
    const form = page.locator('[data-review-form]')
    await expect(form).toBeVisible()
    // No rating, no text: nothing is sent.
    await form.getByRole('button', { name: 'Отправить отзыв' }).click()
    await expect(form.getByRole('alert')).toContainText('Поставьте оценку')
    await form.locator('[data-rating="5"]').click()
    await form.getByRole('textbox', { name: 'Ваш отзыв' }).fill('Всё сделали вовремя, спасибо')
    await form.getByRole('button', { name: 'Отправить отзыв' }).click()
    const done = page.locator('[data-review-done]')
    await expect(done).toContainText('Спасибо за отзыв')
    await expect(done.getByRole('textbox')).toHaveValue(/\/ru\/\?ref=test-client$/)
    // The same project again: HQ says 409 `exists`.
    await open(page, '/ru/cabinet?review=2')
    await page.locator('[data-rating="4"]').click()
    await page.getByRole('textbox', { name: 'Ваш отзыв' }).fill('Ещё раз')
    await page.getByRole('button', { name: 'Отправить отзыв' }).click()
    await expect(page.locator('[data-review-form]').getByRole('alert')).toContainText('уже отправлен')
    expect(errors).toEqual([])
  })
})

test.describe('demo page', () => {
  test('signed out: the scripted example and «Войти» back to this page, no call to the agent', async ({ page }) => {
    const calls: string[] = []
    page.on('request', (r) => r.method() === 'POST' && /\/agent\/|\/api\/demo-agent/.test(r.url()) && calls.push(r.url()))
    await open(page, '/ru/demo/ag_demo1?k=demo-key-0001')
    await expect(page.locator('[data-demo-gate]')).toBeVisible()
    await expect(page.locator('[data-demo-example]')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Войдите, чтобы написать агенту' })).toBeDisabled()
    const login = page.locator('[data-demo-login]')
    await expect(login).toHaveAttribute('href', /next=%2Fru%2Fdemo%2Fag_demo1%3Fk%3Ddemo-key-0001/)
    // The proxy itself refuses without a session.
    const res = await page.request.post('/api/demo-agent/ag_demo1', { data: { demoKey: 'demo-key-0001', text: 'Привет' }, headers: { origin: page.url().split('/ru')[0]! } })
    expect(res.status()).toBe(401)
    expect(calls).toEqual([])
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, `demo signed out ${size.width}`)
    }
  })
})

test.describe('demo page, signed in', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
  })

  test('the chat sends ?k= as demoKey through the site, shows HQ\'s limit and a wrong key says so', async ({ page }) => {
    const errors = watchErrors(page, noise)
    const requests: unknown[] = []
    const direct: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/demo-agent/') && r.method() === 'POST') requests.push(r.postDataJSON())
      // The browser never calls HQ's /agent/ route itself: the client id is added on the server.
      if (/\/agent\/[^/]+\/chat/.test(r.url())) direct.push(r.url())
    })
    await open(page, '/ru/demo/ag_demo1?k=demo-key-0001')
    await page.getByRole('textbox', { name: 'Ваше сообщение' }).fill('Сколько стоит стрижка?')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.locator('[data-demo-msg="agent"]')).toContainText('Демо-ответ агента')
    await expect(page.locator('[data-demo-limit]')).toContainText('Осталось сообщений: 4 из 5')
    expect(requests).toHaveLength(1)
    expect(direct).toEqual([])
    expect(requests[0]).toMatchObject({ demoKey: 'demo-key-0001', text: 'Сколько стоит стрижка?' })
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/)

    await open(page, '/ru/demo/ag_demo1?k=wrong-key-9999')
    await page.getByRole('textbox', { name: 'Ваше сообщение' }).fill('Привет')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.locator('[data-demo-error]')).toContainText('Ссылка демо не подошла')

    // No key at all: a sentence, no chat.
    await open(page, '/ru/demo/ag_demo1')
    await expect(page.locator('[data-demo-nokey]')).toBeVisible()
    await noHorizontalOverflow(page, 'demo')
    expect(errors).toEqual([])
  })
})

test.describe('Shell sections', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('lead: confirm and cancel the call, the booking, what the client was told', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/clients')
    await page.getByRole('button', { name: /Боб/ }).first().click()
    const booking = page.locator('[data-call-booking]')
    await expect(booking).toBeVisible()
    await booking.locator('[data-call-action="confirm"]').click()
    await expect(page.locator('[data-call-booking="confirmed"]')).toBeVisible()
    await expect(page.locator('[data-call-told]')).toContainText('thread in the cabinet, email')
    await page.locator('[data-call-action="cancel"]').click()
    await expect(page.locator('[data-call-booking="cancelled"]')).toBeVisible()
    await expect(page.locator('[data-call-action]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('production: «Этап готов» moves a paid stage on; an unpaid one shows HQ\'s hint', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/projects')
    await page.getByRole('button', { name: /Алиса/ }).first().click()
    await page.locator('[data-ready-stage="2"]').click()
    await expect(page.getByText(/Этап 2 ещё не оплачен: сначала счёт этапа/)).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Pulse Gym/ }).first().click()
    await page.locator('[data-ready-stage="1"]').click()
    await expect(page.getByText('Stage 1 is ready, the client got the acceptance request.')).toBeVisible()
    await expect(page.locator('[data-ready-stage="1"]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('back office: cabinet documents with a failed letter get «Отправить снова»; reviews are listed', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/documents')
    const block = page.locator('[data-cabinet-docs-problems]')
    await expect(block.locator('[data-cabinet-doc="7"]')).toContainText('email did not go out')
    await expect(block.locator('[data-cabinet-doc="7"]')).toContainText('no PDF')
    await expect(block.locator('[data-cabinet-doc="9"]')).toHaveCount(0)
    await block.locator('[data-resend="7"]').click()
    await expect(page.getByText('Email sent.')).toBeVisible()
    await expect(block.locator('[data-cabinet-doc="7"]')).not.toContainText('email did not go out')
    // HQ fails again for the second one: the mark stays and the reason is said.
    await block.locator('[data-resend="8"]').click()
    await expect(page.getByText(/the email failed again/)).toBeVisible()
    await expect(block.locator('[data-cabinet-doc="8"]')).toContainText('email did not go out')

    await page.getByRole('tab', { name: /^Reviews|^Отзывы/ }).click()
    await expect(page.locator('[data-review="2"]')).toContainText('Алиса')
    await expect(page.locator('[data-review="2"]')).toContainText('приносит заявки')
    await expect(page.locator('[data-reviews-average]')).toContainText('4,5')
    expect(errors).toEqual([])
  })

  test('phone: the lead drawer with the booking fits the screen', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/clients')
    await page.getByRole('button', { name: /Боб/ }).first().click()
    await expect(page.locator('[data-call-booking]')).toBeVisible()
    await noHorizontalOverflow(page, 'lead drawer')
  })
})
