import { expect, test } from '@playwright/test'
import ru from '../../src/content/ru'
import { watchErrors, open, openHomeForChat, fakeSessionCookie } from './helpers'

// ---- builder: all 8 steps in one scenario -------------------------------------------------------

test('builder: walk through all 8 steps to the preview, estimate and PDF page', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = watchErrors(page)
  await open(page, '/ru/builder')
  const step = () => page.locator('[aria-current="step"]')
  const next = () => page.getByRole('button', { name: /^Дальше/ })

  // 1. Niche: the explainer, three common niches, «Ещё ниши» opens the rest by category.
  await expect(step()).toHaveAttribute('aria-label', /^1\./)
  await page.getByRole('button', { name: 'Ещё ниши' }).click()
  await page.getByRole('radio', { name: /^Кафе и ресторан/ }).click()
  await expect(page).toHaveURL(/k\.cafe/)
  await expect(step()).toHaveAttribute('aria-label', /^2\./)

  // 2. Products: toggle one off and on again; the agent asks about a site.
  const product = page.getByRole('checkbox', { name: /^ИИ-менеджер заявок/ })
  await product.click()
  await product.click()
  await page.getByRole('radio', { name: /Сайт нужен/ }).click()
  await next().click()

  // 3. Goals: pick a goal and a channel.
  await expect(step()).toHaveAttribute('aria-label', /^3\./)
  await page.getByRole('checkbox', { name: /Запись без звонков/ }).click()
  await page.getByRole('checkbox', { name: /^Instagram/ }).click()
  await next().click()

  // 4. Set: what the products include, then a separate part is added.
  await expect(step()).toHaveAttribute('aria-label', /^4\./)
  await page.getByRole('button', { name: 'Показать отдельные части' }).click()
  await page.getByRole('checkbox', { name: /^Приложения/ }).click()
  await next().click()

  // 5. Features: the total moves with an option.
  await expect(step()).toHaveAttribute('aria-label', /^5\./)
  await page.locator('main button', { hasText: /\+\$\d+/ }).first().click()
  await next().click()

  // 6. Theme: a theme and a mood, then the fine tuning opens.
  await expect(step()).toHaveAttribute('aria-label', /^6\./)
  await page.getByRole('radio', { name: /^Кофейня/ }).click()
  await page.getByRole('radio', { name: /^Премиум/ }).click()
  await page.getByRole('button', { name: 'Тонкая настройка' }).click()
  await next().click()

  // 7. Details: the required ones.
  await expect(step()).toHaveAttribute('aria-label', /^7\./)
  await page.getByLabel('Название вашего бизнеса').fill('Зерно')
  await page.getByRole('checkbox', { name: 'Частные лица' }).click()
  await page.getByLabel('Кто отвечает за проект с вашей стороны').fill('Азиза')
  await page.getByRole('radio', { name: 'Как можно скорее' }).click()
  await page.getByRole('checkbox', { name: 'Сообщить мне сразу' }).click()
  await page.getByLabel('Пожелания').fill('Тест сквозной проверки')
  await next().click()

  // 8. Preview: the live preview, share link, PDF.
  await expect(step()).toHaveAttribute('aria-label', /^8\./)
  await expect(page.locator('[data-live-preview]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Скачать смету (PDF)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить проект' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Скопировать ссылку' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/ru/builder?b=')

  // «Изменить» goes back to the step it belongs to.
  await page.getByRole('button', { name: 'Изменить' }).first().click()
  await expect(step()).not.toHaveAttribute('aria-label', /^8\./)
  expect(errors).toEqual([])
})

test('builder: a build link opens on the right step with the quote', async ({ page }) => {
  await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8')
  await expect(page.getByRole('button', { name: 'Скачать смету (PDF)' })).toBeVisible()
})

test('builder: the PDF button asks for a sign-in before the estimate (cabinet on)', async ({ page }) => {
  await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8')
  await page.getByRole('button', { name: 'Скачать смету (PDF)' }).click()
  await page.locator('input[name=name]').last().fill('E2E Test')
  await page.locator('input[name=contact]').last().fill('e2e@example.com')
  await page.locator('form:has(input[name=contact]) button[type=submit]').last().click()
  await expect(page.locator('[data-lead-auth]')).toBeVisible()
})

test('estimate page lists the build as rows and offers print', async ({ page }) => {
  await open(page, '/ru/builder/estimate?b=websites.landing.telegram~bots.booking.payments~k.cafe')
  const rows = page.locator('table tbody tr')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThanOrEqual(2)
  await expect(page.getByRole('button', { name: 'Сохранить как PDF' })).toBeVisible()
  await expect(page.locator('a[href^="/ru/builder?b="]').first()).toBeVisible()
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toContain('noindex')
})

// ---- the builder sends the lead itself, with the sign-in gate ------------------------------------------

test('builder send: «Отправить проект в работу» asks to sign in, the old #contact link lands on the button', async ({ page }) => {
  await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=8#contact')
  const send = page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' })
  await expect(send).toBeVisible()
  await expect(page.locator('#contact form')).toHaveCount(0)
  await send.click()
  await expect(page.locator('[data-lead-auth]')).toBeVisible()
  await expect(page.locator('[data-lead-auth]')).toContainText('войдите или создайте аккаунт')
})

test('API: a lead without an account is refused (401 auth_required), bad origin is 403', async ({ request, baseURL }) => {
  const body = { name: 'E2E', contact: 'e2e@example.com', service: 'bots', budget: '', message: 'test', locale: 'ru', page: '/ru', estimate: '', slot: '', source: '' }
  const res = await request.post('/api/lead', { data: body, headers: { origin: baseURL! } })
  expect(res.status()).toBe(401)
  expect((await res.json()).error.code).toBe('auth_required')
  const bad = await request.post('/api/lead', { data: body, headers: { origin: 'https://evil.example' } })
  expect(bad.status()).toBe(403)
})

test('audit form: validation, then the sign-in gate', async ({ page }) => {
  await open(page, '/ru/audit')
  await page.getByRole('button', { name: 'Заказать аудит' }).click()
  await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
  await page.locator('input[name=url]').fill('https://example.com')
  await page.locator('input[name=contact]').fill('@e2e_test')
  await page.getByRole('button', { name: 'Заказать аудит' }).click()
  await expect(page.locator('[data-lead-auth]')).toBeVisible()
})

// ---- pay page -----------------------------------------------------------------------------------

test('pay page: mock invoice shows methods, QR and copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, '/ru/pay/FT-2026-001?k=demo')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('FT-2026-001')
  await expect(page.getByRole('tab', { name: 'TON' })).toBeVisible()
  await expect(page.locator('svg[aria-label*="QR"], img[aria-label*="QR"], canvas[aria-label*="QR"], [aria-label*="QR"]').first()).toBeVisible()
  await page.getByRole('tab', { name: 'TON' }).click()
  await page.getByRole('button', { name: 'Скопировать' }).first().click()
  expect((await page.evaluate(() => navigator.clipboard.readText())).length).toBeGreaterThan(10)
})

test('pay page: wrong key and unknown number show the not-found state', async ({ page }) => {
  for (const url of ['/ru/pay/FT-2026-001?k=wrong', '/ru/pay/FT-2026-999?k=demo', '/ru/pay/garbage?k=demo']) {
    const response = await open(page, url)
    expect(response?.status(), url).toBe(404)
  }
  const api = await page.request.get('/api/pay/FT-2026-001?k=demo')
  expect(api.status()).toBe(200)
  expect((await page.request.get('/api/pay/FT-2026-001?k=nope')).status()).toBe(404)
})

// ---- cabinet login ------------------------------------------------------------------------------

test('cabinet login: ?email= prefills the email field (HQ links to bot-lead clients), junk is ignored', async ({ page }) => {
  await open(page, '/ru/cabinet/login?email=anna%40example.com')
  await expect(page.locator('input[type=email]')).toHaveValue('anna@example.com')
  await open(page, '/ru/cabinet/login?email=%3Cscript%3E')
  await expect(page.locator('input[type=email]')).toHaveValue('')
})

test('cabinet login: Google button with the G mark, email form, sign-up and forgot tabs', async ({ page }) => {
  await open(page, '/ru/cabinet/login')
  const google = page.getByRole('button', { name: 'Продолжить с Google' })
  await expect(google).toBeVisible()
  await expect(google.locator('svg')).toHaveCount(1)
  await expect(page.locator('input[type=email]')).toBeVisible()
  await expect(page.locator('input[type=password]')).toBeVisible()
  await page.getByRole('tab', { name: 'Создать аккаунт' }).click()
  await expect(page.getByRole('tab', { name: 'Создать аккаунт' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('input[type=password]').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Войти' }).click()
  await page.getByRole('button', { name: 'Забыли пароль?' }).click()
  await expect(page.locator('input[type=email]')).toBeVisible()
})

test('cabinet v3: signed out, every cabinet tab goes to the login page and every v3 API answers 401', async ({ page, request }) => {
  for (const q of ['', '?tab=documents&doc=q-14', '?tab=messages&ref=lead-14', '?tab=agent', '?tab=materials', '?tab=invoices']) {
    await open(page, `/ru/cabinet${q}`)
    await expect(page).toHaveURL(/\/ru\/cabinet\/login/)
  }
  for (const path of ['/api/cabinet/threads', '/api/cabinet/threads/lead-14/messages', '/api/cabinet/documents', '/api/cabinet/documents/q-14/file', '/api/cabinet/media?u=%2Fmedia%2Fx.pdf', '/api/cabinet/agent']) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(401)
    expect((await res.text()).includes('media/')).toBe(false)
  }
  const origin = { origin: `http://localhost:${process.env.E2E_PORT ?? 3417}` }
  const post = (path: string, data: object) => request.post(path, { data, headers: origin })
  expect((await post('/api/cabinet/documents/q-14/accept', {})).status()).toBe(401)
  expect((await post('/api/cabinet/documents/c-2/sign', { signaturePng: 'x', name: 'A B', consent: true })).status()).toBe(401)
  expect((await post('/api/cabinet/threads/lead-14/messages', { text: 'hi' })).status()).toBe(401)
  expect((await post('/api/cabinet/threads/lead-14/read', {})).status()).toBe(401)
  expect((await post('/api/cabinet/agent/telegram', { botToken: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw' })).status()).toBe(401)
  const upload = await request.post('/api/cabinet/uploads', { multipart: { threadId: 'lead-14', file: { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') } }, headers: origin })
  expect(upload.status()).toBe(401)
  // a foreign origin is refused before anything else
  const foreign = await request.post('/api/cabinet/documents/q-14/accept', { data: {}, headers: { origin: 'https://evil.example' } })
  expect(foreign.status()).toBe(403)
})

test('cabinet pages are noindex', async ({ page }) => {
  await open(page, '/ru/cabinet/login')
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toContain('noindex')
})

// ---- chat widget --------------------------------------------------------------------------------

test('chat widget opens, sends and answers in mock mode, then closes', async ({ page }) => {
  const errors = watchErrors(page)
  await openHomeForChat(page)
  await page.getByRole('button', { name: ru.chat.fab }).click()
  const dialog = page.locator('[role=dialog]')
  await expect(dialog).toContainText('Демо-режим')
  const box = dialog.locator('textarea')
  await expect(dialog.getByRole('button', { name: 'Сайт', exact: true })).toBeVisible()
  await box.fill('Привет, сколько стоит сайт?')
  await dialog.getByLabel('Отправить').click()
  await expect(dialog).toContainText('Привет, сколько стоит сайт?')
  await expect(dialog).toContainText('Когда хотите запуститься?')
  // A quick-reply chip sends too, and the third step asks for contacts.
  await dialog.getByRole('button', { name: 'За неделю' }).click()
  await expect(dialog.locator('textarea, input').first()).toBeVisible()
  await dialog.getByRole('button', { name: 'Закрыть чат' }).click()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test('chat opens from the hero button «Спросить агента»', async ({ page }) => {
  await open(page, '/ru')
  await page.locator('#top').getByRole('link', { name: 'Спросить агента' }).click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
})

test('chat API: validation (400) and mock answer (200)', async ({ request, baseURL }) => {
  const ok = await request.post('/api/chat', {
    data: { sessionId: '3f1c3c9e-6c1f-4f0a-9a43-0f1c5f7a9d11', locale: 'ru', message: 'Привет', page: '/ru' },
    headers: { origin: baseURL! },
  })
  expect(ok.status()).toBe(200)
  expect(ok.headers()['x-chat-mode']).toBe('mock')
  const bad = await request.post('/api/chat', { data: { sessionId: 'x', locale: 'ru', message: '' }, headers: { origin: baseURL! } })
  expect(bad.status()).toBe(400)
})

// ---- services ------------------------------------------------------------------------------------

test('service page: the format link «Собрать проект: …» opens the builder with that format', async ({ page }) => {
  await open(page, '/ru/services/websites')
  await page.getByRole('link', { name: /Собрать проект: Сайт компании/ }).click()
  await expect(page).toHaveURL(/\/ru\/builder\?b=.*websites\.company/)
})

test('solution page opens the builder with its preset', async ({ page }) => {
  await open(page, '/ru/solutions/cafe')
  await page.getByRole('link', { name: 'Собрать это решение' }).first().click()
  await expect(page).toHaveURL(/\/ru\/builder\?b=.*k\.cafe/)
})

test('chat: Enter sends right after opening (queued behind the greeting), Shift+Enter makes a new line', async ({ page }) => {
  // A slow first answer keeps the greeting in flight while the visitor already types and presses Enter.
  let first = true
  await page.route('**/api/chat', async (route) => {
    if (first) {
      first = false
      await new Promise((r) => setTimeout(r, 2500))
    }
    await route.continue()
  })
  await openHomeForChat(page)
  await page.getByRole('button', { name: ru.chat.fab }).click()
  const dialog = page.locator('[role=dialog]')
  const box = dialog.locator('textarea')
  await box.focus()
  await box.pressSequentially('первая строка')
  await box.press('Shift+Enter')
  await box.pressSequentially('вторая')
  await expect(box).toHaveValue('первая строка\nвторая')
  await box.press('Enter')
  await expect(dialog).toContainText('первая строка')
  await expect(box).toHaveValue('')
  await expect(dialog).toContainText('Когда хотите запуститься?')
})

// ---- receptionist 2.0 ----------------------------------------------------------------------------

const hqAnswer = {
  ok: true,
  reply: 'Похоже, вам подойдёт ИИ-администратор. Соберите проект: цену и срок увидите сразу. Или предложу время для звонка.',
  state: 'chat',
  builderLink: 'https://firtech.pro/ru/builder?b=k.salon~p.adminbot~g.booking',
  cta: ['builder', 'call', 'telegram'],
  handoff: true,
}

test('chat: a reply with builderLink and cta shows the builder button, the call picker and the handoff line', async ({ page }) => {
  const errors = watchErrors(page)
  let calls = 0
  const sent: string[] = []
  await page.route('**/api/chat', async (route) => {
    calls++
    const body = route.request().postDataJSON() as { message: string }
    sent.push(body.message)
    await route.fulfill({
      json: calls === 1 ? { ok: true, reply: 'Здравствуйте. Я Фира, ИИ-ассистент Fir Tech.', state: 'chat' } : hqAnswer,
      headers: { 'x-chat-mode': 'hq' },
    })
  })
  await openHomeForChat(page)
  await page.getByRole('button', { name: ru.chat.fab }).click()
  const dialog = page.locator('[role=dialog]')
  await expect(dialog.getByRole('heading', { name: 'Фира, ИИ-ассистент Fir Tech' })).toBeVisible()
  await expect(dialog).toContainText('Я Фира, ИИ-ассистент Fir Tech.')
  await dialog.locator('textarea').fill('У меня салон, нужна запись клиентов')
  await dialog.locator('textarea').press('Enter')
  const build = dialog.locator('[data-chat-cta=builder]')
  await expect(build).toHaveText('Собрать проект')
  // The link stays on this site, relative, and opens in the same tab.
  await expect(build).toHaveAttribute('href', '/ru/builder?b=k.salon~p.adminbot~g.booking')
  await expect(build).not.toHaveAttribute('target', /.+/)
  await expect(dialog.locator('[data-chat-handoff]')).toHaveText('Передал основателю, ответит здесь или в кабинете')
  await expect(dialog.locator('[data-chat-cta=telegram]')).toBeVisible()
  // The call picker: free slots inline, the chosen one goes out as the next message.
  await dialog.locator('[data-chat-cta=call]').click()
  const picker = dialog.locator('[data-chat-slots]')
  await expect(picker).toBeVisible()
  const firstTime = picker.locator('input[name=chatSlot]').first()
  await expect(firstTime).toBeAttached()
  await picker.locator('input[name=chatSlot] + span').first().click()
  await picker.getByRole('button', { name: 'Выбрать это время' }).click()
  await expect(picker).toBeHidden()
  await expect(dialog).toContainText('Мне удобно:')
  expect(sent.at(-1)).toMatch(/^Мне удобно: /)
  expect(errors).toEqual([])
})

test('chat: a failed message keeps its bubble and retries', async ({ page }) => {
  let fail = true
  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON() as { message: string }
    if (body.message !== '/start' && fail) {
      fail = false
      return route.abort()
    }
    await route.fulfill({ json: { ok: true, reply: body.message === '/start' ? 'Здравствуйте.' : 'Принял.', state: 'chat' } })
  })
  await openHomeForChat(page)
  await page.getByRole('button', { name: ru.chat.fab }).click()
  const dialog = page.locator('[role=dialog]')
  await dialog.locator('textarea').fill('Привет')
  await dialog.locator('textarea').press('Enter')
  await expect(dialog.getByRole('button', { name: /Не отправлено/ })).toBeVisible()
  await dialog.getByRole('button', { name: /Не отправлено/ }).click()
  await expect(dialog).toContainText('Принял.')
  await expect(dialog.getByRole('button', { name: /Не отправлено/ })).toHaveCount(0)
})

test('chat: a demo reply shows the demo chip and the reset, and never the sign-in step', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({ json: { ok: true, reply: 'Здравствуйте, это салон «Лилия».', state: 'contact', demo: true } })
  })
  await openHomeForChat(page)
  await page.getByRole('button', { name: ru.chat.fab }).click()
  const dialog = page.locator('[role=dialog]')
  await expect(dialog.locator('[data-chat-demo]')).toHaveText('Демо: вымышленный салон')
  await expect(dialog.locator('[data-chat-auth]')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Сбросить демо' }).first().click()
  await expect(dialog.locator('[data-chat-demo]')).toBeVisible()
})

test('home demo tab, signed out: the scripted example, «Пример», the sign-in prompt and no call to /api/chat', async ({ page }) => {
  const calls: string[] = []
  page.on('request', (r) => r.url().includes('/api/chat') && calls.push(r.url()))
  await open(page, '/ru#demo')
  const demo = page.locator('[data-demo-chat]')
  await expect(demo.locator('[data-demo-example]')).toHaveText('Пример')
  await expect(demo.locator('[data-demo-gate]')).toBeVisible()
  // v4: the frame ends in a lock plate (no input at all): the demo is visibly for signed-in clients.
  await expect(demo.locator('[data-demo-lock]')).toContainText('Войдите, чтобы попробовать на своих данных')
  await expect(demo.getByRole('textbox')).toHaveCount(0)
  await expect(demo.locator('[data-demo-signup]')).toHaveAttribute('href', /tab=signup/)
  await demo.getByRole('button', { name: 'Есть окно на субботу?' }).click()
  await expect(demo.getByText('В субботу свободно 11:00 и 14:30')).toBeVisible()
  await demo.locator('[data-demo-login]').click()
  await expect(page).toHaveURL(/\/ru\/cabinet\/login\?next=%2Fru%3Fdemo%3Dreceptionist%23demo/)
  expect(calls).toEqual([])
})

test('home demo tab, signed out: «Персональный ИИ» shows the example and a sign-in link that returns to the same tab', async ({ page }) => {
  await open(page, '/ru?demo=personal#demo')
  const tab = page.locator('[data-demo-assistant]')
  await expect(tab).toBeVisible()
  await expect(tab.locator('[data-demo-gate]')).toBeVisible()
  await expect(tab.locator('[data-demo-login]')).toHaveAttribute('href', /next=%2Fru%3Fdemo%3Dpersonal%23demo/)
})

test.describe('home demo, signed in', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
  })

  test('the chip names the niche, the client writes freely, sees what is left, «Сбросить демо» clears it', async ({ page }) => {
    const sent: Record<string, unknown>[] = []
    page.on('request', (r) => r.url().includes('/api/chat') && r.method() === 'POST' && sent.push(r.postDataJSON()))
    await open(page, '/ru#demo')
    const demo = page.locator('[data-demo-chat]')
    await expect(demo.locator('[data-chat-demo]')).toHaveText('Демо: вымышленный салон')
    await expect(demo.locator('[data-demo-gate]')).toHaveCount(0)
    await page.locator('[data-niche="clinic"]').click()
    await expect(demo.locator('[data-chat-demo]')).toHaveText('Демо: вымышленная клиника')
    await demo.getByRole('button', { name: 'Работаете в выходные?' }).click()
    await expect(demo.locator('li').nth(1)).toBeVisible()
    await expect(demo.locator('[data-demo-left]')).toContainText('Осталось сообщений сегодня:')
    // The browser sends the persona and nothing about the client: clientId and clientEmail are added on the server.
    expect(sent.every((b) => b.persona === 'clinic' && !('clientEmail' in b) && !('clientId' in b))).toBe(true)
    await demo.getByRole('button', { name: 'Сбросить демо' }).click()
    await expect(demo.getByText('Работаете в выходные?', { exact: true }).and(demo.locator('li'))).toHaveCount(0)
  })

  test('the daily limit shows the friendly plate with «Собрать проект»', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      const body = route.request().postDataJSON() as { message: string }
      if (body.message === '/start') return route.fulfill({ json: { ok: true, reply: 'Здравствуйте.', state: 'chat', demo: true } })
      return route.fulfill({ status: 429, json: { ok: false, error: { code: 'demo_limit', message: 'x' } } })
    })
    await open(page, '/ru#demo')
    const demo = page.locator('[data-demo-chat]')
    await demo.getByRole('textbox').fill('Привет')
    await demo.getByRole('textbox').press('Enter')
    const plate = demo.locator('[data-demo-limit-plate]')
    await expect(plate).toContainText('Демо на сегодня закончилось')
    await expect(plate.getByRole('link', { name: 'Собрать проект' })).toHaveAttribute('href', '/ru/builder')
  })

  test('«Персональный ИИ»: free text goes to the persona `personal`, the answer and the counter show', async ({ page }) => {
    const sent: Record<string, unknown>[] = []
    page.on('request', (r) => r.url().includes('/api/chat') && r.method() === 'POST' && sent.push(r.postDataJSON()))
    await open(page, '/ru?demo=personal#demo')
    const tab = page.locator('[data-demo-assistant]')
    await expect(tab.locator('[data-demo-gate]')).toHaveCount(0)
    await tab.getByRole('textbox').fill('Что у меня сегодня по делам?')
    await tab.getByRole('textbox').press('Enter')
    await expect(tab.getByText('Что у меня сегодня по делам?', { exact: true }).first()).toBeVisible()
    await expect(tab.locator('[data-demo-left]')).toContainText('Осталось сообщений сегодня:')
    expect(sent.some((b) => b.persona === 'personal' && b.message === 'Что у меня сегодня по делам?')).toBe(true)
  })
})
